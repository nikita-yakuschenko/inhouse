import type {
  ClientCutPlanSheet,
  ClientPanel,
} from "@/features/projects/serialize-panels";
import type { MaterialsSpecSummary } from "@/lib/cut-plan/materials-spec";
import {
  aggregatePartQtyOnSheet,
  buildMarkingOnlySheetMap,
  buildPartsByIdMap,
  collectMarkingOnlyPartRows,
  inferSheetSizeMm,
  resolvePdfMaterialName,
  type PdfPartQtyLine,
  type PdfWorkKind,
} from "@/lib/cut-plan/pdf-page-legend";

export type CutPlanPdfCutMapPage = {
  kind: "cut_map";
  workKind: "cutting_and_marking" | "cutting_only";
  panelName: string;
  sheet: ClientCutPlanSheet;
  partLines: PdfPartQtyLine[];
  materialName: string;
  /** На карте раскроя — 1 лист этой заготовки. */
  blankSheetsCount: number;
};

export type CutPlanPdfMarkingPage = {
  kind: "marking_only";
  workKind: "marking_only";
  partLines: PdfPartQtyLine[];
  materialName: string;
  blankSheetsCount: number;
  /** Схема целого листа с этой деталью. */
  sheet: ClientCutPlanSheet;
  sheetTitle: string;
};

export type CutPlanPdfPage = CutPlanPdfCutMapPage | CutPlanPdfMarkingPage;

/** @deprecated используйте CutPlanPdfPage / collectCutPlanPdfPages */
export type CutPlanPdfSheet = CutPlanPdfCutMapPage;

export type CutPlanPdfMeta = {
  projectName: string;
  projectId: string;
  /** Номер договора — в заголовке рядом с заводским номером. */
  contractNumber?: string | null;
  materialLabel?: string | null;
  sheetWidthMm?: number | null;
  sheetHeightMm?: number | null;
  /** Спецификация материалов — отдельная последняя страница PDF. */
  materialsSpec?: MaterialsSpecSummary | null;
};

export function projectPdfTitle(
  meta: Pick<CutPlanPdfMeta, "projectName" | "contractNumber">,
) {
  const contract = meta.contractNumber?.trim();
  return contract ? `${meta.projectName} · ${contract}` : meta.projectName;
}

export function collectCutPlanPdfPages(
  panels: ClientPanel[],
  meta: Pick<
    CutPlanPdfMeta,
    "materialLabel" | "materialsSpec" | "sheetWidthMm" | "sheetHeightMm"
  > = {},
): CutPlanPdfPage[] {
  const materialName = resolvePdfMaterialName({
    materialName: meta.materialsSpec?.materialName,
    materialLabel: meta.materialLabel,
  });
  const inferred = inferSheetSizeMm(panels);
  const sheetWidthMm = meta.sheetWidthMm ?? inferred.widthMm;
  const sheetHeightMm = meta.sheetHeightMm ?? inferred.heightMm;
  const partsById = buildPartsByIdMap(panels);
  const allParts = panels.flatMap((panel) => panel.parts);

  const cutPages: CutPlanPdfCutMapPage[] = panels.flatMap((panel) => {
    const cutPlan = panel.cutPlans[0];
    if (!cutPlan) return [];

    return cutPlan.sheets.map((sheet) => ({
      kind: "cut_map" as const,
      // На листах раскроя детали режут и маркируют.
      workKind: "cutting_and_marking" as const,
      panelName: panel.code?.trim() || panel.name,
      sheet,
      partLines: aggregatePartQtyOnSheet(sheet, partsById),
      materialName,
      blankSheetsCount: 1,
    }));
  });

  const markingPages: CutPlanPdfMarkingPage[] = [];
  if (sheetWidthMm && sheetHeightMm) {
    for (const row of collectMarkingOnlyPartRows(
      allParts,
      sheetWidthMm,
      sheetHeightMm,
    )) {
      markingPages.push({
        kind: "marking_only",
        workKind: "marking_only",
        partLines: [{ marking: row.marking, quantity: row.quantity }],
        materialName,
        blankSheetsCount: row.quantity,
        sheet: buildMarkingOnlySheetMap({
          sheetWidthMm,
          sheetHeightMm,
          marking: row.marking,
          partId: row.partId,
          partWidthMm: row.widthMm,
          partHeightMm: row.heightMm,
        }),
        sheetTitle: `${row.marking} · целый лист · ${sheetWidthMm}×${sheetHeightMm} мм`,
      });
    }
  }

  return [...cutPages, ...markingPages];
}

/** Совместимость со старыми тестами — только карты раскроя. */
export function collectCutPlanPdfSheets(
  panels: ClientPanel[],
  meta?: Pick<
    CutPlanPdfMeta,
    "materialLabel" | "materialsSpec" | "sheetWidthMm" | "sheetHeightMm"
  >,
): CutPlanPdfCutMapPage[] {
  return collectCutPlanPdfPages(panels, meta).filter(
    (page): page is CutPlanPdfCutMapPage => page.kind === "cut_map",
  );
}

export type { PdfPartQtyLine, PdfWorkKind };
