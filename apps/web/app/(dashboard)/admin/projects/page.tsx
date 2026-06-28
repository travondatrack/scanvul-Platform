import { requireActiveUser } from "@/lib/session";
import { notFound } from "next/navigation";
import { AdminProjectsClient } from "./AdminProjectsClient";

export default async function AdminProjectsPage() {
  const user = await requireActiveUser();
  if (user.roleGlobal !== "admin" && user.roleGlobal !== "super_admin") {
    notFound();
  }

  return <AdminProjectsClient />;
}
