import BookingCalendar from "@/components/BookingCalendar";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="text-center">
        <h1 className="text-2xl font-bold">ห้องให้คำปรึกษา</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          เลือกวันที่ว่าง ดูรายชื่อผู้ให้คำปรึกษา แล้วจองคิวได้ทันที
        </p>
      </header>
      <BookingCalendar />
      <footer className="mt-8 text-center text-xs text-black/40 dark:text-white/40">
        <a href="/admin/login" className="hover:underline">
          สำหรับเจ้าหน้าที่
        </a>
      </footer>
    </div>
  );
}
