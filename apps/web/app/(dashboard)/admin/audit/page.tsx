import { requireActiveUser } from "@/lib/session";
import { notFound } from "next/navigation";
import { AdminAuditClient } from "./AdminAuditClient";

export default async function AdminAuditPage() {
  const user = await requireActiveUser();
  if (user.roleGlobal !== "admin" && user.roleGlobal !== "super_admin") {
    notFound();
  }

  return <AdminAuditClient />;
}
