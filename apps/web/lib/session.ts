import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";

export type AuthenticatedUser = {
  id: string;
  email: string | null;
  name?: string | null;
  roleGlobal: string;
  status: string;
};

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user as Partial<AuthenticatedUser> | undefined;

  if (!user?.id) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? null,
    name: user.name ?? null,
    roleGlobal: user.roleGlobal ?? "user",
    status: user.status ?? "active",
  };
}

export async function getCurrentUserId() {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

export async function requireActiveUser() {
  const user = await requireUser();
  if (user.status !== "active") {
    throw new Error("USER_DISABLED");
  }
  return user;
}
