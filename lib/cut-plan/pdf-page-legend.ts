import type {
  ClientCutPlanSheet,
  ClientPanel,
  ClientPart,
  ClientPlacement,
} from "@/features/projects/serialize-panels";
import { resolvePartMarking } from "@/lib/parts/part-marking";
import { partitionPartsByWorkType } from "@/lib/parts/part-work-type";

export type PdfWorkKind =
  | "cutting_and_marking"
  | "cutting_only"
  | "marking_only";

export type PdfPartQtyLine = {
  marking: string;
  quantity: number;
};

export type PdfMarkingOnlyPartRow = PdfPartQtyLine & {
  widthMm: number;
  heightMm: number;
  partId: string;
};

/** Текст штампа в рамке (правый верх). */
export function pdfWorkKindStampLabel(kind: PdfWorkKind): string {
  switch (kind) {
    case "marking_only":
      return "МАРКИРОВКА";
    case "cutting_only":
      return "РАСКРОЙ";
    case "cutting_and_marking":
      return "РАСКРОЙ И МАРКИРОВКА";
  }
}

export function formatPdfPartQtyLine(line: PdfPartQtyLine): string {
  return `Деталь ${line.marking} - ${line.quantity} шт`;
}

export function formatPdfBlankSheetsLine(
  materialName: string,
  count: number,
): string {
  const name = materialName.trim() || "материал";
  return `Листов заготовки ${name} - ${count} шт`;
}

/** Строки шапки: детали и заготовки (тип работ — отдельный штамп). */
export function buildPdfPageLegendLines(input: {
  partLines: PdfPartQtyLine[];
  materialName: string;
  blankSheetsCount: number;
}): string[] {
  return [
    ...input.partLines.map(formatPdfPartQtyLine),
    formatPdfBlankSheetsLine(input.materialName, input.blankSheetsCount),
  ];
}

function partsByIdFromPanels(panels: ClientPanel[]): Map<string, ClientPart> {
  const map = new Map<string, ClientPart>();
  for (const panel of panels) {
    for (const part of panel.parts) {
      map.set(part.id, part);
    }
  }
  return map;
}

/** Сводка деталей на листе раскроя: маркировка → число экземпляров. */
export function aggregatePartQtyOnSheet(
  sheet: ClientCutPlanSheet,
  partsById: Map<string, ClientPart>,
): PdfPartQtyLine[] {
  const counts = new Map<string, number>();

  for (const placement of sheet.placements) {
    const part = partsById.get(placement.partId);
    const marking = part
      ? resolvePartMarking(part.name, part.code)
      : (placement.label?.trim() || String(placement.partInstanceIndex));
    counts.set(marking, (counts.get(marking) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([marking, quantity]) => ({ marking, quantity }))
    .sort((a, b) => a.marking.localeCompare(b.marking, "ru"));
}

/** Детали «только маркировка» с размерами для схемы листа. */
export function collectMarkingOnlyPartRows(
  parts: ClientPart[],
  sheetWidthMm: number | null | undefined,
  sheetHeightMm: number | null | undefined,
): PdfMarkingOnlyPartRow[] {
  const { markingOnly } = partitionPartsByWorkType(
    parts,
    sheetWidthMm,
    sheetHeightMm,
  );
  const byMarking = new Map<string, PdfMarkingOnlyPartRow>();

  for (const part of markingOnly) {
    const marking = resolvePartMarking(part.name, part.code);
    const existing = byMarking.get(marking);
    if (existing) {
      existing.quantity += part.quantity;
      continue;
    }
    byMarking.set(marking, {
      marking,
      quantity: part.quantity,
      widthMm: part.widthMm,
      heightMm: part.heightMm,
      partId: part.id,
    });
  }

  return [...byMarking.values()].sort((a, b) =>
    a.marking.localeCompare(b.marking, "ru"),
  );
}

/** @deprecated — используйте collectMarkingOnlyPartRows */
export function aggregateMarkingOnlyPartQty(
  parts: ClientPart[],
  sheetWidthMm: number | null | undefined,
  sheetHeightMm: number | null | undefined,
): PdfPartQtyLine[] {
  return collectMarkingOnlyPartRows(parts, sheetWidthMm, sheetHeightMm).map(
    ({ marking, quantity }) => ({ marking, quantity }),
  );
}

/**
 * Схема целого листа под маркировку: деталь = весь лист заготовки.
 * Учитываем поворот 90°, если деталь задана «лёжа».
 */
export function buildMarkingOnlySheetMap(input: {
  sheetWidthMm: number;
  sheetHeightMm: number;
  marking: string;
  partId: string;
  partWidthMm: number;
  partHeightMm: number;
}): ClientCutPlanSheet {
  const { sheetWidthMm, sheetHeightMm, marking, partId } = input;

  // Деталь = целый лист; схема — прямоугольник заготовки с маркировкой.
  const placed: ClientPlacement = {
    id: `mark-pl-${partId}`,
    partId,
    partInstanceIndex: 1,
    xMm: 0,
    yMm: 0,
    widthMm: sheetWidthMm,
    heightMm: sheetHeightMm,
    rotationDeg: 0,
    label: marking,
  };

  return {
    id: `mark-sh-${partId}`,
    sheetIndex: 1,
    widthMm: sheetWidthMm,
    heightMm: sheetHeightMm,
    usableXmm: 0,
    usableYmm: 0,
    usableWidthMm: sheetWidthMm,
    usableHeightMm: sheetHeightMm,
    placements: [placed],
    operations: [],
    plannedOffcuts: [],
  };
}

export function resolvePdfMaterialName(options: {
  materialName?: string | null;
  materialLabel?: string | null;
}): string {
  return (
    options.materialName?.trim() ||
    options.materialLabel?.trim() ||
    "материал"
  );
}

export function inferSheetSizeMm(panels: ClientPanel[]): {
  widthMm: number | null;
  heightMm: number | null;
} {
  for (const panel of panels) {
    const sheet = panel.cutPlans[0]?.sheets[0];
    if (sheet) {
      return { widthMm: sheet.widthMm, heightMm: sheet.heightMm };
    }
  }
  return { widthMm: null, heightMm: null };
}

export function buildPartsByIdMap(panels: ClientPanel[]) {
  return partsByIdFromPanels(panels);
}
