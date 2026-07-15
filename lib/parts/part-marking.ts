/** Из «Плитная обшивка внешняя Ст-1-02» → «Ст-1-02». */
export function extractPanelCode(panelName: string): string | null {
  // \b не работает с кириллицей — ищем подстроку Ст-цифры.
  const match = panelName.trim().match(/(Ст-\d+(?:-\d+)+)/i);
  return match?.[1] ?? null;
}

/**
 * Марка на раскрое/в спецификации:
 * «Плитная обшивка внешняя Ст-1-01» + код «02» → «Ст-1-01-02»
 * уже полный «Ст-1-01-02» → как есть.
 */
export function resolvePartMarking(
  partName: string,
  partCode?: string | null,
): string {
  const code = (partCode ?? "").trim();
  const panel = extractPanelCode(partName);
  const name = partName.trim();

  if (code) {
    // Уже полный код вида Ст-1-01-02
    if (/^Ст-\d+(?:-\d+){2,}$/i.test(code)) return code;
    // Код = только маркировка «02» / «2»
    if (panel && /^\d{1,4}$/.test(code)) {
      return `${panel}-${code.padStart(2, "0")}`;
    }
    // Код = «Ст-1-01» без позиции — недостаточно, но лучше короткий код
    if (/^Ст-\d+(?:-\d+)+$/i.test(code)) {
      return code;
    }
    return code;
  }

  return name || "—";
}

/** Подпись на карте: только код; при qty>1 — с номером экземпляра. */
export function formatPartMarkingLabel(
  marking: string,
  instanceIndex: number,
  instanceCount = 1,
): string {
  const base = marking.trim();
  if (!base) return String(instanceIndex);
  if (instanceCount > 1) return `${base} - ${instanceIndex}`;
  return base;
}
