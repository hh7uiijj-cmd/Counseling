"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      return;
    }
    const next = searchParams.get("next") || "/admin/dashboard";
    router.push(next);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-sm flex-col gap-3 rounded-3xl border border-brand-pink-light bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-white/5"
    >
      <div className="mb-2 flex flex-col items-center gap-2">
        <Image src="/brand/logo.png" alt="โลโก้" width={56} height={56} className="rounded-full" />
        <h1 className="text-center text-xl font-semibold text-brand-blue-dark">
          เข้าสู่ระบบเจ้าหน้าที่
        </h1>
      </div>
      <label className="text-sm font-medium">
        ชื่อผู้ใช้
        <input
          required
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mt-1 w-full rounded-xl border border-black/15 p-2 text-sm outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light dark:border-white/20 dark:bg-transparent"
        />
      </label>
      <label className="text-sm font-medium">
        รหัสผ่าน
        <input
          required
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-xl border border-black/15 p-2 text-sm outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light dark:border-white/20 dark:bg-transparent"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="mt-2 rounded-full bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-50"
      >
        {submitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
      </button>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
