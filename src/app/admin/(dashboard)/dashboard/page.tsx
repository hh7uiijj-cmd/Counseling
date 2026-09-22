import { prisma } from "@/lib/prisma";
import { thaiDateLabel, toDateKey, toTimeKey } from "@/lib/dates";
import { BookingStatus } from "@/generated/prisma/enums";
import Link from "next/link";
import StatusBadge from "@/components/admin/StatusBadge";

export default async function DashboardPage() {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [pendingCount, counselorCount, upcoming] = await Promise.all([
    prisma.booking.count({ where: { status: BookingStatus.PENDING } }),
    prisma.counselor.count({ where: { active: true } }),
    prisma.booking.findMany({
      where: {
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        slot: { startsAt: { gte: now, lte: in7Days } },
      },
      include: { slot: { include: { counselor: true } } },
      orderBy: { slot: { startsAt: "asc" } },
      take: 20,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">ภาพรวม</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="รอการยืนยัน" value={pendingCount} href="/admin/bookings?status=PENDING" />
        <StatCard label="ผู้ให้คำปรึกษาที่เปิดใช้งาน" value={counselorCount} href="/admin/counselors" />
        <StatCard label="นัดหมายใน 7 วันข้างหน้า" value={upcoming.length} href="/admin/bookings" />
      </div>

      <div>
        <h2 className="mb-2 font-medium">นัดหมายที่ใกล้ถึง</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/65">ไม่มีนัดหมายใน 7 วันข้างหน้า</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-black/5 text-left dark:bg-white/10">
                <tr>
                  <th className="p-2">วันที่</th>
                  <th className="p-2">เวลา</th>
                  <th className="p-2">ผู้ให้คำปรึกษา</th>
                  <th className="p-2">ผู้จอง</th>
                  <th className="p-2">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((b) => (
                  <tr key={b.id} className="border-t border-black/5 dark:border-white/10">
                    <td className="p-2">{thaiDateLabel(toDateKey(b.slot.date))}</td>
                    <td className="p-2">
                      {toTimeKey(b.slot.startsAt)}-{toTimeKey(b.slot.endsAt)}
                    </td>
                    <td className="p-2">{b.slot.counselor.name}</td>
                    <td className="p-2">{b.clientName}</td>
                    <td className="p-2">
                      <StatusBadge status={b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-black/10 p-4 hover:border-blue-400 dark:border-white/10"
    >
      <p className="text-sm text-black/50 dark:text-white/65">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </Link>
  );
}
