export const SIDEBAR_COOKIE_NAME = "sidebar_state";
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/** По умолчанию сайдбар развёрнут, пока пользователь явно не свернул. */
export function readSidebarOpenFromCookie(cookieValue: string | undefined): boolean {
  return cookieValue !== "false";
}
