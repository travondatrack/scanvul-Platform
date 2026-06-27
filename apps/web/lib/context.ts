import { cookies } from "next/headers";
import { OrgContext } from "@/components/OrgSwitcher";

export async function getOrgContextServer(): Promise<OrgContext> {
  const cookieStore = await cookies();
  const val = cookieStore.get("scanvul_org_context")?.value;
  
  if (!val) {
    return { type: "personal", name: "Personal" };
  }
  
  try {
    return JSON.parse(decodeURIComponent(val)) as OrgContext;
  } catch {
    return { type: "personal", name: "Personal" };
  }
}
