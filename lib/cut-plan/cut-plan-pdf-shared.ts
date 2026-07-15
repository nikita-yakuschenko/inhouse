import type { ClientCutPlanSheet, ClientPanel } from "@/features/projects/serialize-panels";

export type CutPlanPdfSheet = {
  panelName: string;
  sheet: ClientCutPlanSheet;
};

export type CutPlanPdfMeta = {
  projectName: string;
  projectId: string;
  materialLabel?: string | null;
};

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
