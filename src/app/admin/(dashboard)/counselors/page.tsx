"use client";

import { useEffect, useState } from "react";

type Counselor = {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  photoUrl: string | null;
  partnerId: string | null;
  partner: { id: string; name: string } | null;
  color: string;
  active: boolean;
  lineUserId: string | null;
  _count: { slots: number };
};

export default function CounselorsPage() {
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [color, setColor] = useState("#2563eb");
  const [submitting, setSubmitting] = useState(false);

  const [photoUrl, setPhotoUrl] = useState("");
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const [lineIdDrafts, setLineIdDrafts] = useState<Record<string, string>>({});
  const [savingLineId, setSavingLineId] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/counselors")
      .then((res) => res.json())
      .then((data) => {
        setCounselors(data.counselors);
        setLineIdDrafts(
          Object.fromEntries(
            (data.counselors as Counselor[]).map((c) => [c.id, c.lineUserId || ""])
          )
        );
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/admin/counselors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        title: title || undefined,
        photoUrl: photoUrl || undefined,
        color,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError("เกิดข้อผิดพลาด กรุณาตรวจสอบข้อมูล");
      return;
    }
    setName("");
    setTitle("");
    setPhotoUrl("");
    load();
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    setImporting(true);
    setImportMessage(null);
    const res = await fetch("/api/admin/counselors/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: importText }),
    });
    setImporting(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setImportMessage(data.message || "นำเข้าไม่สำเร็จ กรุณาตรวจสอบข้อมูล");
      return;
    }
    setImportMessage(
      `นำเข้าสำเร็จ ${data.created} คน` +
        (data.skipped?.length ? ` (ข้ามชื่อซ้ำ: ${data.skipped.join(", ")})` : "")
    );
    setImportText("");
    load();
  }

  async function patchCounselor(c: Counselor, patch: Record<string, unknown>) {
    const res = await fetch(`/api/admin/counselors/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.message || "บันทึกไม่สำเร็จ");
    }
    load();
  }

  async function handleSaveLineId(c: Counselor) {
    setSavingLineId(c.id);
    const value = (lineIdDrafts[c.id] || "").trim();
    await fetch(`/api/admin/counselors/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineUserId: value || null }),
    });
    setSavingLineId(null);
    load();
  }

  async function toggleActive(c: Counselor) {
    await fetch(`/api/admin/counselors/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !c.active }),
    });
    load();
  }

  async function handleDelete(c: Counselor) {
    if (!confirm(`ต้องการลบ "${c.name}" ใช่หรือไม่?`)) return;
    const res = await fetch(`/api/admin/counselors/${c.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.message || "ไม่สามารถลบได้ กรุณาปิดการใช้งานแทน");
      return;
    }
    load();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">ผู้ให้คำปรึกษา</h1>

      <form
        onSubmit={handleCreate}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-black/10 p-4 dark:border-white/10"
      >
        <label className="text-sm">
          ชื่อ *
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block field"
          />
        </label>
        <label className="text-sm">
          ตำแหน่ง/ความเชี่ยวชาญ
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block field"
          />
        </label>
        <label className="text-sm">
          ลิงก์รูป (ถ้ามี)
          <input
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://..."
            className="mt-1 block field"
          />
        </label>
        <label className="text-sm">
          สี
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="mt-1 block h-9 w-14 rounded-lg border border-black/20 dark:border-white/20"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="btn btn-primary"
        >
          เพิ่มผู้ให้คำปรึกษา
        </button>
      </form>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <form
        onSubmit={handleImport}
        className="flex flex-col gap-2 rounded-xl border border-black/10 p-4 dark:border-white/10"
      >
        <h2 className="font-medium">นำเข้ารายชื่อหลายคนพร้อมกัน</h2>
        <p className="text-xs text-black/60 dark:text-white/65">
          วางรายชื่อบรรทัดละ 1 คน รูปแบบ: ชื่อ,ตำแหน่ง/ความถนัด,ลิงก์รูป (ตำแหน่งและลิงก์รูปไม่ใส่ก็ได้)
          ชื่อที่ซ้ำกับที่มีอยู่จะถูกข้าม
        </p>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          rows={5}
          placeholder={"น้องเอ,การเรียน\nน้องบี,ความสัมพันธ์\nน้องซี"}
          className="field w-full"
        />
        {importMessage && <p className="text-sm text-brand-blue-dark">{importMessage}</p>}
        <div>
          <button type="submit" disabled={importing || !importText.trim()} className="btn btn-secondary">
            {importing ? "กำลังนำเข้า..." : "นำเข้ารายชื่อ"}
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-black/50 dark:text-white/65">กำลังโหลด...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-black/5 text-left dark:bg-white/10">
              <tr>
                <th className="p-2"></th>
                <th className="p-2">รูป</th>
                <th className="p-2">ชื่อ</th>
                <th className="p-2">ตำแหน่ง</th>
                <th className="p-2">คู่เวร</th>
                <th className="p-2">จำนวนคิวที่สร้าง</th>
                <th className="p-2">LINE User ID (สำหรับแท็กชื่อ)</th>
                <th className="p-2">สถานะ</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {counselors.map((c) => (
                <tr key={c.id} className="border-t border-black/5 dark:border-white/10">
                  <td className="p-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      {c.photoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.photoUrl}
                          alt={c.name}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      )}
                      <input
                        key={`${c.id}-${c.photoUrl ?? ""}`}
                        defaultValue={c.photoUrl ?? ""}
                        placeholder="ลิงก์รูป"
                        onBlur={(e) => {
                          const value = e.target.value.trim();
                          if (value !== (c.photoUrl ?? "")) {
                            patchCounselor(c, { photoUrl: value || null });
                          }
                        }}
                        className="field w-32 text-xs"
                      />
                    </div>
                  </td>
                  <td className="p-2">{c.name}</td>
                  <td className="p-2">{c.title || "-"}</td>
                  <td className="p-2">
                    <select
                      value={c.partnerId ?? ""}
                      onChange={(e) => patchCounselor(c, { partnerId: e.target.value || null })}
                      className="field text-xs"
                    >
                      <option value="">ไม่มีคู่</option>
                      {counselors
                        .filter((o) => o.id !== c.id)
                        .map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                            {o.partnerId && o.partnerId !== c.id ? " (มีคู่แล้ว)" : ""}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className="p-2">{c._count.slots}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <input
                        value={lineIdDrafts[c.id] ?? ""}
                        onChange={(e) =>
                          setLineIdDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))
                        }
                        placeholder="U1234... (พิมพ์ 'ไอดีของฉัน' ในกลุ่ม)"
                        className="field w-56 text-xs"
                      />
                      <button
                        onClick={() => handleSaveLineId(c)}
                        disabled={savingLineId === c.id}
                        className="btn btn-secondary text-xs"
                      >
                        {savingLineId === c.id ? "..." : "บันทึก"}
                      </button>
                    </div>
                  </td>
                  <td className="p-2">
                    <button
                      onClick={() => toggleActive(c)}
                      className={[
                        "rounded-full px-2 py-0.5 text-xs",
                        c.active
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-200 text-gray-600",
                      ].join(" ")}
                    >
                      {c.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                    </button>
                  </td>
                  <td className="p-2 text-right">
                    <button
                      onClick={() => handleDelete(c)}
                      className="btn-link text-red-600 dark:text-red-400"
                    >
                      ลบ
                    </button>
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
