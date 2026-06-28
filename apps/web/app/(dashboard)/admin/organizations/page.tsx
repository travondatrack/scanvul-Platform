import { requireActiveUser } from "@/lib/session";
import { notFound } from "next/navigation";
import { AdminOrganizationsClient } from "./AdminOrganizationsClient";

export default async function AdminOrganizationsPage() {
  const user = await requireActiveUser();
  if (user.roleGlobal !== "admin" && user.roleGlobal !== "super_admin") {
    notFound();
  }

  return <AdminOrganizationsClient />;
}
