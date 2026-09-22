"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/admin/dashboard", label: "ภาพรวม" },
  { href: "/admin/bookings", label: "การจอง" },
  { href: "/admin/slots", label: "จัดการคิว" },
  { href: "/admin/counselors", label: "ผู้ให้คำปรึกษา" },
  { href: "/admin/settings", label: "ตั้งค่า" },
];

export default function AdminNav({ username }: { username: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <nav className="flex w-56 shrink-0 flex-col justify-between border-r border-black/10 p-4 dark:border-white/10">
      <div>
        <p className="mb-4 px-2 text-sm text-black/50 dark:text-white/50">
          เข้าสู่ระบบเป็น <span className="font-medium">{username}</span>
        </p>
        <ul className="flex flex-col gap-1">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={[
                  "block rounded-lg px-3 py-2 text-sm",
                  pathname === link.href
                    ? "bg-blue-600 text-white"
                    : "hover:bg-black/5 dark:hover:bg-white/10",
                ].join(" ")}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <button
        onClick={handleLogout}
        className="rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
      >
        ออกจากระบบ
      </button>
    </nav>
  );
}
