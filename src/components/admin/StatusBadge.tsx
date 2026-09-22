const COLOR_MAP: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-200 text-gray-600",
  COMPLETED: "bg-blue-100 text-blue-800",
};

const LABEL_MAP: Record<string, string> = {
  PENDING: "รอยืนยัน",
  CONFIRMED: "ยืนยันแล้ว",
  CANCELLED: "ยกเลิก",
  COMPLETED: "เสร็จสิ้น",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${COLOR_MAP[status] ?? ""}`}>
      {LABEL_MAP[status] ?? status}
    </span>
  );
}
