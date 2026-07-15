import * as XLSX from "xlsx";

export type ParsedSpecificationPart = {
  name: string;
  code: string;
  widthMm: number;
  heightMm: number;
  quantity: number;
};

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
      normalized.some((cell) => cell.includes("кол"))
    );
  });
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
  return text.padStart(2, "0");
}

function buildPartName(prefix: string, code: string): string {
  const trimmedPrefix = prefix.trim();
  if (!trimmedPrefix) return `[${code}]`;
  return `${trimmedPrefix} [${code}]`;
}

function extractSheetPrefix(sheetName: string): string {
  const beforeDash = sheetName.split(" - ")[0]?.trim();
  return beforeDash || sheetName.trim();
}

export function parseSpecificationXlsx(
  buffer: ArrayBuffer | Buffer,
  options?: { namePrefix?: string },
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
    throw new Error("Не найдена строка заголовков (Ширина / Длина / Кол-во)");
  }

  const prefix = options?.namePrefix ?? extractSheetPrefix(sheetName);
  const parts: ParsedSpecificationPart[] = [];

  for (let index = headerRowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const marking = parseMarking(row[1]);
    const widthMm = parsePositiveInt(row[2]);
    const heightMm = parsePositiveInt(row[3]);
    const quantity = parsePositiveInt(row[5]);

    if (!marking || !widthMm || !heightMm || !quantity) continue;

    parts.push({
      code: marking,
      name: buildPartName(prefix, marking),
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
