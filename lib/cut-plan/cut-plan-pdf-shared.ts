import type { ClientCutPlanSheet, ClientPanel } from "@/features/projects/serialize-panels";
import type { MaterialsSpecSummary } from "@/lib/cut-plan/materials-spec";

export type CutPlanPdfSheet = {
  panelName: string;
  sheet: ClientCutPlanSheet;
};

export type CutPlanPdfMeta = {
  projectName: string;
  projectId: string;
  /** Номер договора — в заголовке рядом с заводским номером. */
  contractNumber?: string | null;
  materialLabel?: string | null;
  /** Спецификация материалов — отдельная последняя страница PDF. */
  materialsSpec?: MaterialsSpecSummary | null;
};

export function projectPdfTitle(meta: Pick<CutPlanPdfMeta, "projectName" | "contractNumber">) {
  const contract = meta.contractNumber?.trim();
  return contract ? `${meta.projectName} · ${contract}` : meta.projectName;
}

export function collectCutPlanPdfSheets(panels: ClientPanel[]): CutPlanPdfSheet[] {
  return panels.flatMap((panel) => {
    const cutPlan = panel.cutPlans[0];
    if (!cutPlan) {
      return [];
    }

    return cutPlan.sheets.map((sheet) => ({
      // В PDF — марка панели (Ст-1-02), полное имя остаётся в данных панели.
      panelName: panel.code?.trim() || panel.name,
      sheet,
    }));
  });
}
