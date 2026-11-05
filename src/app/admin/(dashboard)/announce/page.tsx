"use client";

import { useEffect, useState } from "react";

type Counselor = { id: string; name: string; fullName: string | null; canTag: boolean };

function nextFriday() {
  const d = new Date();
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function AnnouncePage() {
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [signupUrl, setSignupUrl] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [text, setText] = useState("");
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [date, setDate] = useState(nextFriday());
  const [sending, setSending] = useState(false);
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

  const taggable = counselors.filter((c) => c.canTag);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-xl font-semibold">ประกาศลง LINE</h1>
      <p className="text-sm text-black/60 dark:text-white/75">
        ระบบจะไม่ส่งข้อความลงกลุ่มเองเมื่อมีคนลงเวร/ยกเลิก/สลับเวรอีกแล้ว แอดมินกดส่งเองจากหน้านี้เท่านั้น
        (การแจ้งเตือนเมื่อมีผู้ขอรับคำปรึกษาจองคิวยังส่งตามปกติ)
      </p>
      {!configured && (
        <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
          ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN หรือ LINE_GROUP_ID ใน Vercel
        </p>
      )}

      <section className="rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-2 font-medium">ข้อความ</h2>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <button type="button" onClick={fillSignup} className="btn">
            ใส่ข้อความ &quot;เปิดลงเวร&quot; + ลิงก์
          </button>
          <label className="text-sm">
            วันที่
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="ml-2 field" />
          </label>
          <button type="button" onClick={fillSummary} className="btn">
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
        {result && (
          <p className={`mt-3 text-sm ${result.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {result.message}
          </p>
        )}
      </section>
    </div>
  );
}
