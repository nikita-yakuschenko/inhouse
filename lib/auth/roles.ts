export const APP_ROLES = ["estimator", "operator"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const DEFAULT_APP_ROLE: AppRole = "estimator";

export const ROLE_COOKIE_NAME = "app_role";

export const ROLE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const ROLE_LABELS: Record<AppRole, string> = {
  estimator: "Сметчик",
  operator: "Оператор",
};

export function isAppRole(value: string | undefined): value is AppRole {
  return value === "estimator" || value === "operator";
}

export function readAppRoleFromCookie(cookieValue: string | undefined): AppRole {
  return isAppRole(cookieValue) ? cookieValue : DEFAULT_APP_ROLE;
}
