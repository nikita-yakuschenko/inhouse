import * as XLSX from "xlsx";

import { extractPanelCode } from "@/lib/parts/part-marking";

export type ParsedSpecificationPart = {
  /** Полное имя обшивки/панели из колонки «Панель». */
  panelName: string;
  /** Код стены/панели: Ст-1-02. */
  panelCode: string;
  /** Код детали: Ст-1-02-01. */
  code: string;
  /** Имя детали — то же, что панель (тип обшивки). */
  name: string;
  widthMm: number;
  heightMm: number;
  quantity: number;
};

export { extractPanelCode } from "@/lib/parts/part-marking";

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "");
}

function findHeaderRowIndex(rows: unknown[][]): number {
  return rows.findIndex((row) => {
    const normalized = row.map(normalizeHeader);
    return (
      normalized.some((cell) => cell.includes("ширина")) &&
      normalized.some((cell) => cell.includes("длина") || cell.includes("высота")) &&
      normalized.some((cell) => cell.includes("кол")) &&
      normalized.some((cell) => cell.includes("панель") || cell.includes("маркир"))
    );
  });
}

type ColumnIndexes = {
  marking: number;
  width: number;
  height: number;
  quantity: number;
  panel: number;
};

function findColumnIndexes(headerRow: unknown[]): ColumnIndexes {
  const normalized = headerRow.map(normalizeHeader);

  const marking = normalized.findIndex((cell) => cell.includes("маркир"));
  const width = normalized.findIndex((cell) => cell.includes("ширина"));
  const height = normalized.findIndex(
    (cell) => cell.includes("длина") || cell.includes("высота"),
  );
  const quantity = normalized.findIndex((cell) => cell.includes("кол"));
  const panel = normalized.findIndex((cell) => cell.includes("панель"));

  if (marking < 0 || width < 0 || height < 0 || quantity < 0 || panel < 0) {
    throw new Error(
      "Нужны колонки: Маркировка, Ширина, Длина, Кол-во, Панель",
    );
  }

  return { marking, width, height, quantity, panel };
}

function parsePositiveInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.round(number);
}

function parseMarking(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) return text.padStart(2, "0");
  return text;
}

export function parseSpecificationXlsx(
  buffer: ArrayBuffer | Buffer,
): ParsedSpecificationPart[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    defval: "",
  });

  const headerRowIndex = findHeaderRowIndex(rows);
  if (headerRowIndex < 0) {
    throw new Error(
      "Не найдена строка заголовков (Маркировка / Ширина / Длина / Кол-во / Панель)",
    );
  }

  const columns = findColumnIndexes(rows[headerRowIndex] ?? []);
  const parts: ParsedSpecificationPart[] = [];

  for (let index = headerRowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const marking = parseMarking(row[columns.marking]);
    const widthMm = parsePositiveInt(row[columns.width]);
    const heightMm = parsePositiveInt(row[columns.height]);
    const quantity = parsePositiveInt(row[columns.quantity]);
    const panelName = String(row[columns.panel] ?? "").trim();

    if (!marking || !widthMm || !heightMm || !quantity || !panelName) continue;

    const panelCode = extractPanelCode(panelName);
    if (!panelCode) {
      throw new Error(
        `В названии панели нет кода вида «Ст-…»: «${panelName}»`,
      );
    }

    parts.push({
      panelName,
      panelCode,
      code: `${panelCode}-${marking}`,
      name: panelName,
      widthMm,
      heightMm,
      quantity,
    });
  }

  if (parts.length === 0) {
    throw new Error("В файле нет строк с деталями");
  }

  return parts;
}
