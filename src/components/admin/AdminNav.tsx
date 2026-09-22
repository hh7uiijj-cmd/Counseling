"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

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
    <nav className="flex shrink-0 flex-col border-b border-black/10 p-3 sm:p-4 md:h-screen md:w-56 md:justify-between md:border-r md:border-b-0 dark:border-white/10">
      <div>
        <div className="mb-3 flex items-center justify-between gap-2 md:mb-4 md:block">
          <p className="truncate px-2 text-sm text-black/50 dark:text-white/65">
            เข้าสู่ระบบเป็น <span className="font-medium">{username}</span>
          </p>
          <ThemeToggle className="shrink-0 md:hidden" />
        </div>
        <ul className="flex gap-1 overflow-x-auto md:flex-col">
          {links.map((link) => (
            <li key={link.href} className="shrink-0">
              <Link
                href={link.href}
                className={[
                  "block rounded-full px-3 py-2 text-sm whitespace-nowrap transition md:rounded-lg",
                  pathname === link.href
                    ? "bg-brand-blue text-white"
                    : "hover:bg-black/5 dark:hover:bg-white/10",
                ].join(" ")}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-3 flex items-center justify-between md:mt-0">
        <button onClick={handleLogout} className="btn-link text-red-600 dark:text-red-400">
          ออกจากระบบ
        </button>
        <ThemeToggle className="hidden md:inline-flex" />
      </div>
    </nav>
  );
}
