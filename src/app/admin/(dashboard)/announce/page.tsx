"use client";

import { useEffect, useState } from "react";

type Counselor = { id: string; name: string; fullName: string | null; canTag: boolean };

function nextFriday() {
  const d = new Date();
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const SAMPLE_GROUPS: { title: string; items: { kind: string; label: string }[] }[] = [
  {
    title: "ลงเวร / สลับเวร (ผู้ให้คำปรึกษา)",
    items: [
      { kind: "signup-card", label: "การ์ดเปิดลงเวร" },
      { kind: "shift-signup", label: "มีคนลงเวร (รออีก 1 คน)" },
      { kind: "shift-full", label: "เวรครบ 2 คน" },
      { kind: "shift-cancel", label: "ยกเลิกเวร" },
      { kind: "swap-request", label: "ขอสลับเวร" },
      { kind: "swap-accepted", label: "สลับเวรสำเร็จ" },
      { kind: "swap-declined", label: "ปฏิเสธสลับเวร" },
    ],
  },
  {
    title: "ผู้ขอรับคำปรึกษา",
    items: [
      { kind: "booking-new", label: "มีคนจองคิวใหม่ (การ์ด + ปุ่มยืนยัน/ยกเลิก)" },
      { kind: "booking-confirmed", label: "ยืนยันการจองแล้ว" },
      { kind: "booking-cancelled", label: "ยกเลิกการจอง" },
    ],
  },
];

export default function AnnouncePage() {
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [signupUrl, setSignupUrl] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [text, setText] = useState("");
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [date, setDate] = useState(nextFriday());
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [cardNote, setCardNote] = useState("");
  const [sendingCard, setSendingCard] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/line-broadcast")
      .then((r) => r.json())
      .then((d) => {
        setCounselors(d.counselors ?? []);
        setSignupUrl(d.signupUrl ?? null);
        setConfigured(Boolean(d.configured));
      })
      .catch(() => {});
  }, []);

  function fillSignup() {
    setText(
      `📢 เปิดลงเวรโครงการเพื่อนวัยใส\nกดลิงก์เพื่อเลือกลงเวรวันศุกร์ (1 ช่วงเวลามี 2 ที่นั่ง)\n${
        signupUrl ?? "(ยังไม่ได้ตั้งค่า LIFF_ID)"
      }`
    );
  }

  async function fillSummary() {
    const res = await fetch(`/api/admin/line-broadcast?summaryDate=${date}`);
    const d = await res.json().catch(() => ({}));
    if (d.summary) setText(d.summary);
  }

  function toggle(id: string) {
    setMentionIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function send() {
    if (!window.confirm("ส่งข้อความนี้ลงกลุ่ม LINE ตอนนี้เลยใช่ไหม?")) return;
    setSending(true);
    setResult(null);
    const res = await fetch("/api/admin/line-broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, mentionIds }),
    });
    const d = await res.json().catch(() => ({}));
    setSending(false);
    if (res.ok) {
      setResult({ ok: true, message: `ส่งลงกลุ่มแล้ว${d.tagged ? ` (แท็ก ${d.tagged} คน)` : ""}` });
      setText("");
      setMentionIds([]);
    } else {
      setResult({ ok: false, message: d.message || "ส่งไม่สำเร็จ" });
    }
  }

  async function sendSample(kind: string, label: string) {
    setTesting(kind);
    setResult(null);
    const res = await fetch("/api/admin/line-broadcast/sample", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    });
    const d = await res.json().catch(() => ({}));
    setTesting(null);
    setResult(
      res.ok
        ? { ok: true, message: `ส่งข้อความทดสอบ "${label}" เข้ากลุ่มแล้ว ไปดูในกลุ่ม LINE ได้เลย` }
        : { ok: false, message: d.message || "ส่งไม่สำเร็จ" }
    );
  }

  async function sendSignupCard() {
    if (!window.confirm("ส่งการ์ด \"เปิดลงเวร\" ลงกลุ่ม LINE ตอนนี้เลยใช่ไหม?")) return;
    setSendingCard(true);
    setResult(null);
    const res = await fetch("/api/admin/line-broadcast/signup-card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: cardNote }),
    });
    const d = await res.json().catch(() => ({}));
    setSendingCard(false);
    setResult(
      res.ok
        ? { ok: true, message: "ส่งการ์ดเปิดลงเวรลงกลุ่มแล้ว" }
        : { ok: false, message: d.message || "ส่งไม่สำเร็จ" }
    );
    if (res.ok) setCardNote("");
  }

  const taggable = counselors.filter((c) => c.canTag);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-xl font-semibold">ประกาศลง LINE</h1>
      <p className="text-sm text-black/60 dark:text-white/75">
        ระบบส่งข้อความลงกลุ่มเองเมื่อมีคนลงเวร/ยกเลิก/สลับเวร และเมื่อมีผู้ขอรับคำปรึกษาจองคิว
        ส่วนหน้านี้ใช้ส่งประกาศเพิ่มเองและทดสอบการส่ง
      </p>
      {result && (
        <p
          className={`rounded-lg p-3 text-sm ${result.ok ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-red-500/10 text-red-600 dark:text-red-400"}`}
        >
          {result.message}
        </p>
      )}
      {!configured && (
        <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
          ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN หรือ LINE_GROUP_ID ใน Vercel
        </p>
      )}

      <section className="rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-1 font-medium">เปิดลงเวร (การ์ดมีปุ่ม &quot;ลงเวร&quot;)</h2>
        <p className="mb-3 text-sm text-black/60 dark:text-white/75">
          ส่งการ์ดเข้ากลุ่ม ผู้ให้คำปรึกษากดปุ่ม &quot;ลงเวร&quot; เพื่อเปิดหน้าลงเวร (LIFF) ได้ทันที
        </p>
        <label className="block text-sm">
          ข้อความเพิ่มเติมบนการ์ด (ไม่บังคับ เช่น กำหนดปิดลงเวร)
          <input
            value={cardNote}
            onChange={(e) => setCardNote(e.target.value)}
            maxLength={200}
            placeholder="เช่น ลงเวรได้ถึงวันพุธนี้"
            className="field mt-1 block w-full"
          />
        </label>
        <div className="mt-3">
          <button onClick={sendSignupCard} disabled={sendingCard || !configured} className="btn btn-primary">
            {sendingCard ? "กำลังส่ง..." : "ส่งการ์ดเปิดลงเวรลงกลุ่ม"}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-1 font-medium">ทดสอบข้อความอัตโนมัติทุกแบบ</h2>
        <p className="mb-3 text-sm text-black/60 dark:text-white/75">
          กดปุ่มเพื่อให้บอทส่ง &quot;ตัวอย่าง&quot; ข้อความนั้นเข้ากลุ่ม LINE (ขึ้นต้น 🧪 [ทดสอบ] ไม่มีการบันทึกข้อมูลจริงในระบบ
          ปุ่มยืนยัน/ยกเลิกบนการ์ดจองตัวอย่างจะตอบว่าไม่พบข้อมูลการจอง)
        </p>
        <div className="flex flex-col gap-4">
          {SAMPLE_GROUPS.map((g) => (
            <div key={g.title}>
              <h3 className="mb-2 text-sm font-medium">{g.title}</h3>
              <div className="flex flex-wrap gap-2">
                {g.items.map((it) => (
                  <button
                    key={it.kind}
                    onClick={() => sendSample(it.kind, it.label)}
                    disabled={testing !== null || !configured}
                    className="btn btn-secondary"
                  >
                    {testing === it.kind ? "กำลังส่ง..." : it.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-2 font-medium">ส่งข้อความอื่น ๆ (พิมพ์เอง)</h2>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <button type="button" onClick={fillSignup} className="btn btn-secondary">
            ใส่ข้อความ &quot;เปิดลงเวร&quot; + ลิงก์
          </button>
          <label className="text-sm">
            วันที่
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="ml-2 field" />
          </label>
          <button type="button" onClick={fillSummary} className="btn btn-secondary">
            ใส่สรุปตารางเวรของวันนั้น
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          maxLength={4500}
          placeholder="พิมพ์ข้อความที่จะส่งลงกลุ่ม..."
          className="field block w-full"
        />

        <h3 className="mt-4 mb-1 text-sm font-medium">แท็กผู้ให้คำปรึกษา (ไม่บังคับ)</h3>
        {taggable.length === 0 ? (
          <p className="text-xs text-black/60 dark:text-white/65">
            ยังไม่มีใครผูกบัญชี LINE (ต้องให้ผู้ให้คำปรึกษาเปิดหน้าลงเวรผ่าน LINE ก่อน จึงจะแท็กได้)
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {taggable.map((c) => (
              <label key={c.id} className="flex items-center gap-1 rounded-full border border-black/10 px-3 py-1 text-sm dark:border-white/10">
                <input type="checkbox" checked={mentionIds.includes(c.id)} onChange={() => toggle(c.id)} />
                {c.name}
              </label>
            ))}
            <button type="button" className="text-xs underline" onClick={() => setMentionIds(taggable.map((c) => c.id))}>
              เลือกทั้งหมด
            </button>
          </div>
        )}

        <div className="mt-4">
          <button onClick={send} disabled={sending || !text.trim() || !configured} className="btn btn-primary">
            {sending ? "กำลังส่ง..." : "ส่งลงกลุ่ม LINE"}
          </button>
        </div>
      </section>
    </div>
  );
}
