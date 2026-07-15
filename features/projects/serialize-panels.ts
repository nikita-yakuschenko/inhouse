import type {
  CutOperation,
  CutPlan,
  CutPlanSheet,
  Part,
  Placement,
  PlannedOffcut,
} from "@/app/generated/prisma/client";

export type ClientPlacement = Pick<
  Placement,
  | "id"
  | "partId"
  | "partInstanceIndex"
  | "xMm"
  | "yMm"
  | "widthMm"
  | "heightMm"
  | "rotationDeg"
  | "label"
>;

export type ClientCutOperation = Pick<
  CutOperation,
  | "id"
  | "sequenceNumber"
  | "operationType"
  | "axis"
  | "x1Mm"
  | "y1Mm"
  | "x2Mm"
  | "y2Mm"
  | "note"
>;

export type ClientPlannedOffcut = Pick<
  PlannedOffcut,
  "id" | "xMm" | "yMm" | "widthMm" | "heightMm" | "isUseful"
>;

export type ClientCutPlanSheet = Pick<
  CutPlanSheet,
  | "id"
  | "sheetIndex"
  | "widthMm"
  | "heightMm"
  | "usableXmm"
  | "usableYmm"
  | "usableWidthMm"
  | "usableHeightMm"
> & {
  placements: ClientPlacement[];
  operations: ClientCutOperation[];
  plannedOffcuts: ClientPlannedOffcut[];
};

export type ClientCutPlan = Pick<
  CutPlan,
  "id" | "totalSheetsCount" | "totalOperationsCount" | "totalSetupChangesCount"
> & {
  wastePercent: number | null;
  sheets: ClientCutPlanSheet[];
};

export type ClientPart = Pick<
  Part,
  "id" | "name" | "code" | "widthMm" | "heightMm" | "quantity" | "allowRotation"
>;

export type ClientPanel = {
  id: string;
  name: string;
  parts: ClientPart[];
  cutPlans: ClientCutPlan[];
};

export type ClientSheetContext = {
  label: string;
  materialName: string | null;
  thicknessMm: number | null;
  sheetFormatName: string | null;
  sheetWidthMm: number | null;
  sheetHeightMm: number | null;
};

type ProjectWithSheetContext = {
  material: { name: string; thicknessMm: number | { toNumber(): number } } | null;
  sheetFormat: {
    name: string;
    widthMm: number;
    heightMm: number;
    thicknessMm: number | { toNumber(): number };
  } | null;
};

function toMmNumber(
  value: number | string | { toNumber(): number; toString(): string } | null | undefined,
): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value.trim().replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value.toNumber === "function") {
    const parsed = value.toNumber();
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : null;
}

function withMmSuffix(name: string): string {
  const trimmed = name.trim();
  return trimmed.endsWith("мм") ? trimmed : `${trimmed} мм`;
}

export function serializeSheetContext(
  project: ProjectWithSheetContext,
): ClientSheetContext | null {
  const sheetFormat = project.sheetFormat;
  const material = project.material;

  if (!sheetFormat && !material) {
    return null;
  }

  const thicknessMm =
    toMmNumber(sheetFormat?.thicknessMm) ?? toMmNumber(material?.thicknessMm);

  // В шапке — полное имя материала, не только «3000×1250 мм».
  const label = material?.name?.trim()
    ? material.name.trim()
    : sheetFormat
      ? withMmSuffix(sheetFormat.name)
      : "Материал";

  return {
    label,
    materialName: material?.name ?? null,
    thicknessMm,
    sheetFormatName: sheetFormat?.name ?? null,
    sheetWidthMm: sheetFormat?.widthMm ?? null,
    sheetHeightMm: sheetFormat?.heightMm ?? null,
  };
}

type PanelWithRelations = {
  id: string;
  name: string;
  parts: Part[];
  cutPlans: (CutPlan & {
    sheets: (CutPlanSheet & {
      placements: Placement[];
      operations: CutOperation[];
      plannedOffcuts: PlannedOffcut[];
    })[];
  })[];
};

export function serializePanelsForClient(panels: PanelWithRelations[]): ClientPanel[] {
  return panels.map((panel) => ({
    id: panel.id,
    name: panel.name,
    parts: panel.parts.map((part) => ({
      id: part.id,
      name: part.name,
      code: part.code,
      widthMm: part.widthMm,
      heightMm: part.heightMm,
      quantity: part.quantity,
      allowRotation: part.allowRotation,
    })),
    cutPlans: panel.cutPlans.map((cutPlan) => ({
      id: cutPlan.id,
      totalSheetsCount: cutPlan.totalSheetsCount,
      totalOperationsCount: cutPlan.totalOperationsCount,
      totalSetupChangesCount: cutPlan.totalSetupChangesCount,
      wastePercent:
        cutPlan.wastePercent !== null && cutPlan.wastePercent !== undefined
          ? Number(cutPlan.wastePercent)
          : null,
      sheets: cutPlan.sheets.map((sheet) => ({
        id: sheet.id,
        sheetIndex: sheet.sheetIndex,
        widthMm: sheet.widthMm,
        heightMm: sheet.heightMm,
        usableXmm: sheet.usableXmm,
        usableYmm: sheet.usableYmm,
        usableWidthMm: sheet.usableWidthMm,
        usableHeightMm: sheet.usableHeightMm,
        placements: sheet.placements.map((placement) => ({
          id: placement.id,
          partId: placement.partId,
          partInstanceIndex: placement.partInstanceIndex,
          xMm: placement.xMm,
          yMm: placement.yMm,
          widthMm: placement.widthMm,
          heightMm: placement.heightMm,
          rotationDeg: placement.rotationDeg,
          label: placement.label,
        })),
        operations: sheet.operations.map((operation) => ({
          id: operation.id,
          sequenceNumber: operation.sequenceNumber,
          operationType: operation.operationType,
          axis: operation.axis,
          x1Mm: operation.x1Mm,
          y1Mm: operation.y1Mm,
          x2Mm: operation.x2Mm,
          y2Mm: operation.y2Mm,
          note: operation.note,
        })),
        plannedOffcuts: sheet.plannedOffcuts.map((offcut) => ({
          id: offcut.id,
          xMm: offcut.xMm,
          yMm: offcut.yMm,
          widthMm: offcut.widthMm,
          heightMm: offcut.heightMm,
          isUseful: offcut.isUseful,
        })),
      })),
    })),
  }));
}
