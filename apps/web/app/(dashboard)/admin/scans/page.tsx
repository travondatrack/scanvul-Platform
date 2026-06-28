import { requireActiveUser } from "@/lib/session";
import { notFound } from "next/navigation";
import { AdminScansClient } from "./AdminScansClient";

export default async function AdminScansPage() {
  const user = await requireActiveUser();
  if (user.roleGlobal !== "admin" && user.roleGlobal !== "super_admin") {
    notFound();
  }

  return <AdminScansClient />;
}
