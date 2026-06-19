"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import {
  isAppRole,
  ROLE_COOKIE_MAX_AGE,
  ROLE_COOKIE_NAME,
  type AppRole,
} from "@/lib/auth/roles";

export async function setAppRoleAction(role: AppRole) {
  if (!isAppRole(role)) {
    throw new Error("Неизвестная роль");
  }

  const cookieStore = await cookies();
  cookieStore.set(ROLE_COOKIE_NAME, role, {
    path: "/",
    maxAge: ROLE_COOKIE_MAX_AGE,
    sameSite: "lax",
  });

  revalidatePath("/", "layout");
}
