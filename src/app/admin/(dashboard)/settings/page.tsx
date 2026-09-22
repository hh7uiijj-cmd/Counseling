"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordResult, setPasswordResult] = useState<{ ok: boolean; message: string } | null>(
    null
  );

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
              className="mt-1 block w-full max-w-xs rounded-lg border border-black/20 p-2 text-sm dark:border-white/20 dark:bg-transparent"
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
              className="mt-1 block w-full max-w-xs rounded-lg border border-black/20 p-2 text-sm dark:border-white/20 dark:bg-transparent"
            />
          </label>
          <div>
            <button
              type="submit"
              disabled={changingPassword}
              className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-50"
            >
              {changingPassword ? "กำลังบันทึก..." : "เปลี่ยนรหัสผ่าน"}
            </button>
          </div>
          {passwordResult && (
            <p className={`text-sm ${passwordResult.ok ? "text-green-600" : "text-red-600"}`}>
              {passwordResult.message}
            </p>
          )}
        </form>
      </section>

      <h2 className="text-lg font-semibold">การแจ้งเตือน LINE</h2>

      <section className="rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-2 font-medium">ขั้นตอนการตั้งค่า (ทำครั้งเดียว)</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-black/70 dark:text-white/70">
          <li>
            สร้าง LINE Official Account และเปิดใช้งาน Messaging API ที่{" "}
            <span className="font-mono">LINE Developers Console</span>
          </li>
          <li>คัดลอก <span className="font-mono">Channel access token</span> และ <span className="font-mono">Channel secret</span></li>
          <li>เชิญบัญชี Official Account เข้ากลุ่ม LINE ที่ต้องการรับแจ้งเตือน</li>
          <li>
            หา Group ID โดยตั้งค่า Webhook URL เป็น{" "}
            <span className="font-mono">https://your-domain/api/line/webhook</span> แล้วพิมพ์ข้อความใดๆ ในกลุ่ม
            เพื่อดู groupId จาก log ของเซิร์ฟเวอร์ (event.source.groupId)
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
        <p className="mb-3 text-sm text-black/60 dark:text-white/60">
          ระบบจะส่งข้อความทดสอบไปยังกลุ่ม LINE ที่ตั้งค่าไว้
        </p>
        <button
          onClick={handleTest}
          disabled={testing}
          className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-50"
        >
          {testing ? "กำลังส่ง..." : "ส่งข้อความทดสอบ"}
        </button>
        {result && (
          <p className={`mt-3 text-sm ${result.ok ? "text-green-600" : "text-red-600"}`}>
            {result.message}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-2 font-medium">ปฏิทินใน LINE</h2>
        <p className="text-sm text-black/60 dark:text-white/60">
          สมาชิกในกลุ่มสามารถพิมพ์ <span className="font-mono">&quot;ตารางวันนี้&quot;</span> หรือ{" "}
          <span className="font-mono">&quot;ตารางพรุ่งนี้&quot;</span> เพื่อให้บอทตอบกลับตารางคิวในรูปแบบการ์ดปฏิทิน
          ได้ทันที (ต้องตั้งค่า Webhook URL ก่อน)
        </p>
      </section>
    </div>
  );
}
