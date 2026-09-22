"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildMonthGrid,
  THAI_MONTHS,
  THAI_WEEKDAYS_SHORT,
  todayKey,
} from "@/lib/calendarGrid";
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

type SlotItem = {
  id: string;
  counselorId: string;
  counselorName: string;
  counselorTitle: string | null;
  counselorColor: string;
  startTime: string;
  endTime: string;
  available: boolean;
};

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

export default function BookingCalendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [days, setDays] = useState<Record<string, DaySummary>>({});
  const [loadingMonth, setLoadingMonth] = useState(true);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotItem[] | null>(null);
  const [dateClosed, setDateClosed] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);

  const [bookingSlot, setBookingSlot] = useState<SlotItem | null>(null);

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const today = todayKey();

  useEffect(() => {
    let cancelled = false;
    const monthStr = `${year}-${String(month).padStart(2, "0")}`;
    fetch(`/api/availability?month=${monthStr}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const map: Record<string, DaySummary> = {};
        for (const d of data.days as DaySummary[]) map[d.date] = d;
        setDays(map);
      })
      .finally(() => !cancelled && setLoadingMonth(false));
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  function goPrevMonth() {
    setLoadingMonth(true);
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function goNextMonth() {
    setLoadingMonth(true);
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  function selectDate(dateKeyStr: string) {
    setSelectedDate(dateKeyStr);
    setSlots(null);
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
    <div className="grid gap-4 sm:gap-6 md:grid-cols-[1fr_360px]">
      <div className="card p-3 sm:p-4">
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={goPrevMonth}
            className="btn btn-ghost h-9 w-9 p-0"
            aria-label="เดือนก่อนหน้า"
          >
            ◀
          </button>
          <h2 className="text-base font-semibold text-brand-blue-dark sm:text-lg">
            {THAI_MONTHS[month - 1]} {year + 543}
          </h2>
          <button
            onClick={goNextMonth}
            className="btn btn-ghost h-9 w-9 p-0"
            aria-label="เดือนถัดไป"
          >
            ▶
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium text-black/50 sm:gap-1 sm:text-xs dark:text-white/50">
          {THAI_WEEKDAYS_SHORT.map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
          {grid.map((cell) => {
            const summary = days[cell.key];
            const isPast = cell.key < today;
            const isSelected = cell.key === selectedDate;
            const isClosed = summary?.closed;
            const hasAvailability = summary && summary.availableSlots > 0 && !isClosed;

            return (
              <button
                key={cell.key}
                disabled={!cell.inMonth || isPast}
                onClick={() => selectDate(cell.key)}
                className={[
                  "flex h-12 flex-col items-center justify-start rounded-lg border p-1 text-xs transition sm:h-16 sm:rounded-xl sm:text-sm",
                  !cell.inMonth ? "opacity-30" : "",
                  isPast ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:border-brand-blue active:scale-95",
                  isSelected
                    ? "border-brand-pink ring-2 ring-brand-pink-light"
                    : "border-black/10 dark:border-white/10",
                  cell.key === today ? "font-bold text-brand-blue-dark" : "",
                ].join(" ")}
              >
                <span>{cell.day}</span>
                {cell.inMonth && !isPast && (
                  <span
                    className={[
                      "mt-1 h-2 w-2 rounded-full",
                      isClosed
                        ? "bg-gray-400"
                        : hasAvailability
                        ? "bg-green-500"
                        : summary
                        ? "bg-red-400"
                        : "bg-transparent",
                    ].join(" ")}
                    title={
                      isClosed
                        ? "ปิดทำการ"
                        : hasAvailability
                        ? "มีคิวว่าง"
                        : "ไม่มีคิวว่าง"
                    }
                  />
                )}
              </button>
            );
          })}
        </div>

        {loadingMonth && (
          <p className="mt-2 text-xs text-black/40 dark:text-white/60">กำลังโหลดข้อมูล...</p>
        )}

        <div className="mt-4 flex flex-wrap gap-4 text-xs text-black/60 dark:text-white/75">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-green-500" /> มีคิวว่าง
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-400" /> เต็มแล้ว
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-gray-400" /> ปิดทำการ
          </span>
        </div>
      </div>

      <div className="card p-3 sm:p-4">
        {!selectedDate && (
          <p className="text-sm text-black/50 dark:text-white/65">
            เลือกวันที่ทางซ้ายเพื่อดูผู้ให้คำปรึกษาและเวลาว่าง
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
                {slots.map((slot) => (
                  <li
                    key={slot.id}
                    className="flex items-center justify-between rounded-lg border border-black/10 p-2 text-sm dark:border-white/10"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: slot.counselorColor }}
                      />
                      <div>
                        <p className="font-medium">
                          {slot.startTime} - {slot.endTime}
                        </p>
                        <p className="text-xs text-black/50 dark:text-white/65">
                          {slot.counselorName}
                          {slot.counselorTitle ? ` · ${slot.counselorTitle}` : ""}
                        </p>
                      </div>
                    </div>
                    {slot.available ? (
                      <button
                        onClick={() => setBookingSlot(slot)}
                        className="btn btn-primary btn-sm"
                      >
                        จองคิว
                      </button>
                    ) : (
                      <span className="rounded-full bg-gray-200 px-3 py-1.5 text-xs text-gray-500 dark:bg-white/10">
                        ไม่ว่าง
                      </span>
                    )}
                  </li>
                ))}
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
