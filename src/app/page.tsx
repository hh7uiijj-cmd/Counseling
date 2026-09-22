import Image from "next/image";
import BookingCalendar from "@/components/BookingCalendar";
import ThemeToggle from "@/components/ThemeToggle";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-5xl px-3 pt-3 sm:px-4 sm:pt-6">
        <div className="mb-2 flex justify-end">
          <ThemeToggle />
        </div>
        <div className="overflow-hidden rounded-2xl shadow-sm sm:rounded-3xl">
          <Image
            src="/brand/hero-banner.webp"
            alt="ศูนย์ให้คำปรึกษา มหาวิทยาลัยสวนดุสิต"
            width={1200}
            height={400}
            priority
            className="h-auto w-full object-cover"
          />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-3 py-6 sm:px-4 sm:py-8">
        <header className="flex flex-col items-center gap-3 text-center">
          <Image
            src="/brand/logo.png"
            alt="โลโก้ศูนย์ให้คำปรึกษา"
            width={72}
            height={72}
            className="h-16 w-16 rounded-full shadow-sm sm:h-[72px] sm:w-[72px]"
          />
          <div>
            <h1 className="text-xl font-bold text-brand-blue-dark sm:text-2xl">
              ศูนย์ให้คำปรึกษา มหาวิทยาลัยสวนดุสิต
            </h1>
            <p className="mt-1 text-sm text-black/60 dark:text-white/70">
              เลือกวันที่ว่าง ดูรายชื่อผู้ให้คำปรึกษา แล้วจองคิวได้ทันที
            </p>
          </div>
        </header>

        <BookingCalendar />

        <footer className="mt-8 text-center text-xs text-black/40 dark:text-white/50">
          <p>ห้อง SDU Counseling Center อาคาร 2 ชั้น 2 · วันจันทร์-ศุกร์ 09.00-16.00 น. · โทร 02-244-5006</p>
          <a href="/admin/login" className="btn-link mt-1 inline-block">
            สำหรับเจ้าหน้าที่
          </a>
        </footer>
      </div>
    </div>
  );
}
