"use client";

import Script from "next/script";
import { useCallback, useEffect, useState } from "react";

// Minimal typing for the parts of the LIFF SDK we use.
type Liff = {
  init: (config: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  login: () => void;
  getIDToken: () => string | null;
};
declare global {
  interface Window {
    liff?: Liff;
  }
}

type Shift = {
  id: string;
  dateLabel: string;
  startTime: string;
  endTime: string;
  pairLabel: string;
  members: { id?: string; name: string }[];
  seatsOpen: number;
  hasBooking: boolean;
  locked: boolean;
};
type SwapTarget = Shift & { targetId: string; targetName: string };
type Swap = {
  id: string;
  from: Shift;
  to: Shift;
  requesterName: string;
  targetName: string;
};
type MeData = {
  counselor: { id: string; name: string };
  settings: { maxShiftsPerPerson: number; changeCutoffHours: number };
  myCount: number;
  myShifts: Shift[];
  openShifts: Shift[];
  swapTargets: SwapTarget[];
  incoming: Swap[];
  outgoing: Swap[];
};

type Phase =
  | { name: "loading" }
  | { name: "error"; message: string }
  | { name: "link"; options: { id: string; name: string }[] }
  | { name: "ready" };

const timeRange = (s: Shift) => `${s.startTime}-${s.endTime} น.`;

export default function MeApp({ liffId }: { liffId: string }) {
  const [sdkReady, setSdkReady] = useState(false);
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [idToken, setIdToken] = useState<string | null>(null);
  const [data, setData] = useState<MeData | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [swapFrom, setSwapFrom] = useState<string | null>(null);
  const [swapTo, setSwapTo] = useState("");
  const [linkChoice, setLinkChoice] = useState("");

  const loadData = useCallback(async () => {
    const res = await fetch("/api/me", { cache: "no-store" });
    if (res.ok) setData(await res.json());
    return res.ok;
  }, []);

  // Sign in once the LIFF SDK script has loaded.
  useEffect(() => {
    if (!sdkReady || !liffId) return;
    (async () => {
      try {
        await window.liff!.init({ liffId });
        if (!window.liff!.isLoggedIn()) {
          window.liff!.login();
          return;
        }
        const token = window.liff!.getIDToken();
        if (!token) {
          setPhase({
            name: "error",
            message: "อ่านข้อมูลบัญชี LINE ไม่ได้ (ต้องเปิดสิทธิ์ openid ใน LIFF) กรุณาแจ้งแอดมิน",
          });
          return;
        }
        setIdToken(token);
        const res = await fetch("/api/me/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: token }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setPhase({ name: "error", message: "ยืนยันตัวตนกับ LINE ไม่สำเร็จ กรุณาลองเปิดลิงก์ใหม่" });
          return;
        }
        if (body.status === "needs_link") {
          setPhase({ name: "link", options: body.options });
          return;
        }
        await loadData();
        setPhase({ name: "ready" });
      } catch (err) {
        console.error(err);
        setPhase({ name: "error", message: "เปิดหน้านี้ไม่สำเร็จ กรุณาเปิดจากลิงก์ในไลน์อีกครั้ง" });
      }
    })();
  }, [sdkReady, liffId, loadData]);

  async function call(url: string, init: RequestInit, okText: string) {
    setBusy(true);
    setNotice(null);
    const res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json" },
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setNotice({ ok: true, text: okText });
    } else {
      setNotice({ ok: false, text: body.message || "ดำเนินการไม่สำเร็จ กรุณาลองใหม่" });
    }
    await loadData();
    return res.ok;
  }

  async function handleLink() {
    if (!idToken || !linkChoice) return;
    setBusy(true);
    const res = await fetch("/api/me/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, counselorId: linkChoice }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setNotice({ ok: false, text: body.message || "ผูกบัญชีไม่สำเร็จ" });
      return;
    }
    await loadData();
    setPhase({ name: "ready" });
  }

  const claim = (s: Shift) =>
    call(`/api/me/shifts/${s.id}`, { method: "POST" }, `ลงเวร ${s.dateLabel} ${timeRange(s)} แล้ว`);

  const release = (s: Shift) => {
    if (!confirm(`ยกเลิกเวร ${s.dateLabel} ${timeRange(s)} ใช่หรือไม่?`)) return;
    return call(`/api/me/shifts/${s.id}`, { method: "DELETE" }, "ยกเลิกเวรแล้ว");
  };

  async function sendSwap(fromSlotId: string) {
    if (!swapTo) return;
    const [toSlotId, targetId] = swapTo.split("|");
    const ok = await call(
      "/api/me/swaps",
      { method: "POST", body: JSON.stringify({ fromSlotId, toSlotId, targetId }) },
      "ส่งคำขอสลับเวรแล้ว รอคนนั้นตอบรับ"
    );
    if (ok) {
      setSwapFrom(null);
      setSwapTo("");
    }
  }

  const answerSwap = (id: string, action: "accept" | "decline" | "cancel") =>
    call(
      `/api/me/swaps/${id}`,
      { method: "POST", body: JSON.stringify({ action }) },
      action === "accept" ? "สลับเวรสำเร็จ" : action === "decline" ? "ปฏิเสธคำขอแล้ว" : "ยกเลิกคำขอแล้ว"
    );

  const card = "rounded-xl border border-black/10 p-3 dark:border-white/10";

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-3 py-4">
      <Script
        src="https://static.line-scdn.net/liff/edge/2/sdk.js"
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
      />

      <h1 className="text-lg font-bold text-brand-blue-dark">ลงเวร · ศูนย์ให้คำปรึกษา</h1>

      {!liffId && (
        <p className="text-sm text-red-600 dark:text-red-400">
          ยังไม่ได้ตั้งค่า LIFF_ID บนเซิร์ฟเวอร์ กรุณาแจ้งแอดมิน
        </p>
      )}

      {liffId && phase.name === "loading" && (
        <p className="text-sm text-black/60 dark:text-white/70">กำลังเข้าสู่ระบบด้วย LINE...</p>
      )}

      {phase.name === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{phase.message}</p>
      )}

      {phase.name === "link" && (
        <div className={`${card} flex flex-col gap-3`}>
          <p className="text-sm">
            ครั้งแรกที่เข้าใช้งาน กรุณาเลือกชื่อของคุณ ระบบจะผูกกับบัญชี LINE นี้ถาวร
          </p>
          <select
            value={linkChoice}
            onChange={(e) => setLinkChoice(e.target.value)}
            className="field"
          >
            <option value="">-- เลือกชื่อ --</option>
            {phase.options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleLink}
            disabled={busy || !linkChoice}
            className="btn btn-primary"
          >
            ยืนยัน
          </button>
          {notice && !notice.ok && (
            <p className="text-sm text-red-600 dark:text-red-400">{notice.text}</p>
          )}
        </div>
      )}

      {phase.name === "ready" && data && (
        <>
          <div className={card}>
            <p className="font-medium">{data.counselor.name}</p>
            <p className="mt-1 text-sm">
              เวรที่ลงไว้: {data.myCount}
              {data.settings.maxShiftsPerPerson > 0 ? ` / ${data.settings.maxShiftsPerPerson}` : ""} เวร
            </p>
            <p className="mt-1 text-xs text-black/60 dark:text-white/70">
              1 เวรมีผู้ให้คำปรึกษา 2 คน และจะเปิดให้จองเมื่อลงชื่อครบ 2 คน
            </p>
          </div>

          {notice && (
            <p
              className={`text-sm ${notice.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
            >
              {notice.text}
            </p>
          )}

          {data.incoming.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="font-medium">คำขอสลับเวรถึงคุณ</h2>
              {data.incoming.map((r) => (
                <div key={r.id} className={`${card} flex flex-col gap-2 text-sm`}>
                  <p>
                    <b>{r.requesterName}</b> ขอสลับเวรกับคุณ
                  </p>
                  <p>
                    เวรของเขา: {r.from.dateLabel} {timeRange(r.from)}
                    <br />
                    เวรของคุณ: {r.to.dateLabel} {timeRange(r.to)}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => answerSwap(r.id, "accept")}
                      disabled={busy}
                      className="btn btn-success btn-sm"
                    >
                      ยอมรับ
                    </button>
                    <button
                      onClick={() => answerSwap(r.id, "decline")}
                      disabled={busy}
                      className="btn btn-danger btn-sm"
                    >
                      ปฏิเสธ
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          <section className="flex flex-col gap-2">
            <h2 className="font-medium">เวรของคุณ</h2>
            {data.myShifts.length === 0 && (
              <p className="text-sm text-black/60 dark:text-white/70">ยังไม่ได้ลงเวร ลองลงจากรายการเวรว่างด้านล่าง</p>
            )}
            {data.myShifts.map((s) => {
              const canChange = !s.locked && !s.hasBooking;
              return (
                <div key={s.id} className={`${card} flex flex-col gap-2`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {s.dateLabel} · {timeRange(s)}
                      </p>
                      <p className="text-xs text-black/60 dark:text-white/70">{s.pairLabel}</p>
                    </div>
                    {s.hasBooking ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                        มีผู้จองแล้ว
                      </span>
                    ) : s.seatsOpen > 0 ? (
                      <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                        รออีก {s.seatsOpen} คน · ยังไม่เปิดให้จอง
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                        เปิดให้จองแล้ว
                      </span>
                    )}
                  </div>
                  {canChange ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSwapFrom(swapFrom === s.id ? null : s.id);
                          setSwapTo("");
                        }}
                        className="btn btn-secondary btn-sm"
                      >
                        ขอสลับ
                      </button>
                      <button
                        onClick={() => release(s)}
                        disabled={busy}
                        className="btn btn-danger btn-sm"
                      >
                        ยกเลิกเวร
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-black/50 dark:text-white/60">
                      {s.hasBooking
                        ? "มีผู้จองแล้ว ติดต่อแอดมินหากต้องการเปลี่ยน"
                        : `ใกล้ถึงเวลาแล้ว เปลี่ยนไม่ได้ (ต้องล่วงหน้า ${data.settings.changeCutoffHours} ชม.)`}
                    </p>
                  )}
                  {swapFrom === s.id && (
                    <div className="flex flex-col gap-2">
                      <select
                        value={swapTo}
                        onChange={(e) => setSwapTo(e.target.value)}
                        className="field text-sm"
                      >
                        <option value="">-- เลือกคนที่อยากสลับเวรด้วย --</option>
                        {data.swapTargets
                          .filter((o) => !o.locked && !o.hasBooking)
                          .map((o) => (
                            <option key={`${o.id}-${o.targetId}`} value={`${o.id}|${o.targetId}`}>
                              {o.targetName} · {o.dateLabel} {timeRange(o)}
                            </option>
                          ))}
                      </select>
                      <button
                        onClick={() => sendSwap(s.id)}
                        disabled={busy || !swapTo}
                        className="btn btn-primary btn-sm"
                      >
                        ส่งคำขอสลับ
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          {data.outgoing.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="font-medium">คำขอสลับที่คุณส่งไป (รอตอบรับ)</h2>
              {data.outgoing.map((r) => (
                <div key={r.id} className={`${card} flex flex-col gap-2 text-sm`}>
                  <p>
                    {r.from.dateLabel} {timeRange(r.from)} ↔ {r.to.dateLabel} {timeRange(r.to)}
                    <br />
                    <span className="text-xs text-black/60 dark:text-white/70">กับ {r.targetName}</span>
                  </p>
                  <button
                    onClick={() => answerSwap(r.id, "cancel")}
                    disabled={busy}
                    className="btn btn-secondary btn-sm self-start"
                  >
                    ยกเลิกคำขอ
                  </button>
                </div>
              ))}
            </section>
          )}

          <section className="flex flex-col gap-2">
            <h2 className="font-medium">เวรว่าง</h2>
            {data.openShifts.length === 0 && (
              <p className="text-sm text-black/60 dark:text-white/70">ตอนนี้ไม่มีเวรว่าง</p>
            )}
            {data.openShifts.map((s) => (
              <div key={s.id} className={`${card} flex items-center justify-between gap-2`}>
                <div>
                  <p className="font-medium">
                    {s.dateLabel} · {timeRange(s)}
                  </p>
                  <p className="text-xs text-black/60 dark:text-white/70">
                    {s.members.length > 0
                      ? `ลงแล้ว: ${s.members.map((m) => m.name).join(", ")} · ว่าง ${s.seatsOpen} ที่`
                      : `ว่างทั้ง 2 ที่`}
                  </p>
                </div>
                <button
                  onClick={() => claim(s)}
                  disabled={busy}
                  className="btn btn-primary btn-sm"
                >
                  ลงเวร
                </button>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
