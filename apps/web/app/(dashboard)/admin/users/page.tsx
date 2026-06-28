import { requireActiveUser } from "@/lib/session";
import { notFound } from "next/navigation";
import { AdminUsersClient } from "./AdminUsersClient";

export default async function AdminUsersPage() {
  const user = await requireActiveUser();
  if (user.roleGlobal !== "admin" && user.roleGlobal !== "super_admin") {
    notFound();
  }

  return <AdminUsersClient currentUserRole={user.roleGlobal} />;
}
