import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import AdminNav from "@/components/admin/AdminNav";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <AdminNav username={session.username} />
      <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
