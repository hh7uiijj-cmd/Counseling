"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordResult, setPasswordResult] = useState<{ ok: boolean; message: string } | null>(
    null
  );

  const [maxShifts, setMaxShifts] = useState(2);
  const [cutoffHours, setCutoffHours] = useState(24);
  const [savingShift, setSavingShift] = useState(false);
  const [shiftResult, setShiftResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/shift-settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) {
          setMaxShifts(d.settings.maxShiftsPerPerson);
          setCutoffHours(d.settings.changeCutoffHours);
        }
      })
      .catch(() => {});
  }, []);

  async function handleSaveShiftSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingShift(true);
    setShiftResult(null);
    const res = await fetch("/api/admin/shift-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxShiftsPerPerson: maxShifts, changeCutoffHours: cutoffHours }),
    });
    setSavingShift(false);
    setShiftResult(
      res.ok
        ? { ok: true, message: "บันทึกการตั้งค่าแล้ว" }
        : { ok: false, message: "บันทึกไม่สำเร็จ กรุณาตรวจสอบตัวเลข" }
    );
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setChangingPassword(true);
    setPasswordResult(null);
    const res = await fetch("/api/admin/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    setChangingPassword(false);
    if (res.ok) {
      setPasswordResult({ ok: true, message: "เปลี่ยนรหัสผ่านสำเร็จ" });
      setCurrentPassword("");
      setNewPassword("");
    } else {
      setPasswordResult({ ok: false, message: data.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ" });
    }
  }

  async function handleTest() {
    setTesting(true);
    setResult(null);
    const res = await fetch("/api/admin/line-test", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setTesting(false);
    if (res.ok) {
      setResult({ ok: true, message: "ส่งข้อความทดสอบไปยังกลุ่ม LINE สำเร็จ กรุณาตรวจสอบในกลุ่ม" });
    } else {
      setResult({ ok: false, message: data.message || "ส่งข้อความไม่สำเร็จ กรุณาตรวจสอบการตั้งค่า" });
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-xl font-semibold">ตั้งค่า</h1>

      <section className="rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-2 font-medium">เปลี่ยนรหัสผ่านแอดมิน</h2>
        <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
          <label className="text-sm">
            รหัสผ่านปัจจุบัน
            <input
              required
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 block w-full max-w-xs field"
            />
          </label>
          <label className="text-sm">
            รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)
            <input
              required
              minLength={8}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 block w-full max-w-xs field"
            />
          </label>
          <div>
            <button
              type="submit"
              disabled={changingPassword}
              className="btn btn-primary"
            >
              {changingPassword ? "กำลังบันทึก..." : "เปลี่ยนรหัสผ่าน"}
            </button>
          </div>
          {passwordResult && (
            <p className={`text-sm ${passwordResult.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {passwordResult.message}
            </p>
          )}
        </form>
      </section>

      <h2 className="text-lg font-semibold">การแจ้งเตือน LINE</h2>

      <section className="rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-2 font-medium">ขั้นตอนการตั้งค่า (ทำครั้งเดียว)</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-black/70 dark:text-white/80">
          <li>
            สร้าง LINE Official Account และเปิดใช้งาน Messaging API ที่{" "}
            <span className="font-mono">LINE Developers Console</span>
          </li>
          <li>คัดลอก <span className="font-mono">Channel access token</span> และ <span className="font-mono">Channel secret</span></li>
          <li>เชิญบัญชี Official Account เข้ากลุ่ม LINE ที่ต้องการรับแจ้งเตือน</li>
          <li>
            ตั้งค่า Webhook URL เป็น{" "}
            <span className="font-mono">https://your-domain/api/line/webhook</span> แล้วเปิด &quot;Use
            webhook&quot; จากนั้นพิมพ์คำว่า <span className="font-mono">&quot;รหัสกลุ่ม&quot;</span>{" "}
            ในกลุ่ม LINE บอทจะตอบกลับ Group ID ให้ทันที
          </li>
          <li>
            ใส่ค่าทั้งหมดในไฟล์ <span className="font-mono">.env</span>:
            <pre className="mt-2 overflow-x-auto rounded-lg bg-black/5 p-3 text-xs dark:bg-white/10">
{`LINE_CHANNEL_ACCESS_TOKEN="..."
LINE_CHANNEL_SECRET="..."
LINE_GROUP_ID="..."`}
            </pre>
          </li>
          <li>รีสตาร์ทเซิร์ฟเวอร์ แล้วกดปุ่มทดสอบด้านล่าง</li>
        </ol>
      </section>

      <section className="rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-2 font-medium">ทดสอบการแจ้งเตือน</h2>
        <p className="mb-3 text-sm text-black/60 dark:text-white/75">
          ระบบจะส่งข้อความทดสอบไปยังกลุ่ม LINE ที่ตั้งค่าไว้
        </p>
        <button
          onClick={handleTest}
          disabled={testing}
          className="btn btn-primary"
        >
          {testing ? "กำลังส่ง..." : "ส่งข้อความทดสอบ"}
        </button>
        {result && (
          <p className={`mt-3 text-sm ${result.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {result.message}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-1 font-medium">กติกาการลงเวร</h2>
        <p className="mb-3 text-xs text-black/60 dark:text-white/65">
          ใช้กับหน้าลงเวรของผู้ให้คำปรึกษา ผู้ขอรับคำปรึกษาจะจองได้เมื่อเวรมีผู้ให้คำปรึกษาครบ 2 คน (ใส่ 0 = ไม่จำกัด)
        </p>
        <form onSubmit={handleSaveShiftSettings} className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            จำนวนเวรสูงสุดที่แต่ละคนถือไว้พร้อมกัน
            <input
              type="number"
              min={0}
              value={maxShifts}
              onChange={(e) => setMaxShifts(Number(e.target.value))}
              className="mt-1 block w-32 field"
            />
          </label>
          <label className="text-sm">
            ยกเลิก/สลับเวรได้ก่อนถึงเวลา (ชั่วโมง)
            <input
              type="number"
              min={0}
              value={cutoffHours}
              onChange={(e) => setCutoffHours(Number(e.target.value))}
              className="mt-1 block w-32 field"
            />
          </label>
          <button type="submit" disabled={savingShift} className="btn btn-primary">
            {savingShift ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </form>
        {shiftResult && (
          <p
            className={`mt-3 text-sm ${shiftResult.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
          >
            {shiftResult.message}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-2 font-medium">ปฏิทินใน LINE</h2>
        <p className="text-sm text-black/60 dark:text-white/75">
          สมาชิกในกลุ่มสามารถพิมพ์ <span className="font-mono">&quot;ตารางวันนี้&quot;</span> หรือ{" "}
          <span className="font-mono">&quot;ตารางพรุ่งนี้&quot;</span> เพื่อให้บอทตอบกลับตารางคิวในรูปแบบการ์ดปฏิทิน
          ได้ทันที (ต้องตั้งค่า Webhook URL ก่อน)
        </p>
      </section>

      <p className="text-center text-xs text-black/40 dark:text-white/60">web app by Tanawat Sangnon</p>
    </div>
  );
}
