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
        <div className="mx-auto max-w-xl overflow-hidden rounded-2xl shadow-sm sm:rounded-3xl">
          <Image
            src="/brand/young-counselors.webp"
            alt="โครงการเพื่อนวัยใส รู้ใจวัยรุ่นและวัยทำงาน (Young Counselors) รุ่นที่ 5"
            width={1254}
            height={1254}
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
            <p className="text-sm font-medium text-black/60 dark:text-white/70">
              ศูนย์ให้คำปรึกษา มหาวิทยาลัยสวนดุสิต
            </p>
            <h1 className="sr-only">
              โครงการเพื่อนวัยใส รู้ใจวัยรุ่นและวัยทำงาน (Young Counselors) รุ่นที่ 5
            </h1>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-black/70 dark:text-white/80 sm:text-base">
              นักศึกษาหลักสูตรจิตวิทยาอุตสาหกรรมและองค์การ คณะมนุษยศาสตร์และสังคมศาสตร์ ชั้นปีที่ 3
              ปฏิบัติหน้าที่เป็น “นักศึกษาฝึกปฏิบัติการให้คำปรึกษา” ณ ศูนย์ให้คำปรึกษา มหาวิทยาลัยสวนดุสิต
              (SDU Counseling Center)
            </p>
            <p className="mt-3 text-sm text-black/60 dark:text-white/70">
              เลือกวันศุกร์และช่วงเวลา ดูรูปและชื่อผู้ให้คำปรึกษา แล้วจองคิวได้ทันที
            </p>
          </div>
        </header>

        <BookingCalendar />

        <footer className="mt-8 text-center text-xs text-black/40 dark:text-white/60">
          <p>ห้อง SDU Counseling Center อาคาร 2 ชั้น 2 · วันจันทร์-ศุกร์ 09.00-16.00 น. · โทร 02-244-5006</p>
          <a href="/admin/login" className="btn-link mt-1 inline-block">
            สำหรับเจ้าหน้าที่
          </a>
          <p className="mt-3">web app by Tanawat Sangnon</p>
        </footer>
      </div>
    </div>
  );
}
