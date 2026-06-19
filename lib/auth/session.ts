import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  readAppRoleFromCookie,
  ROLE_COOKIE_NAME,
  type AppRole,
} from "@/lib/auth/roles";

export async function getAppRole(): Promise<AppRole> {
  const cookieStore = await cookies();
  return readAppRoleFromCookie(cookieStore.get(ROLE_COOKIE_NAME)?.value);
}

export async function requireAppRole(expected: AppRole) {
  const role = await getAppRole();
  if (role === expected) {
    return role;
  }

  redirect(expected === "operator" ? "/operator" : "/");
}
