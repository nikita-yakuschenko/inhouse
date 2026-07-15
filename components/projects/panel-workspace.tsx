"use client";

import { Suspense, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { OperationsSheet } from "@/components/cut-plan/operations-sheet";
import { SheetTabsPanel } from "@/components/cut-plan/sheet-tabs-panel";
import { PartsPanel } from "@/components/parts/parts-panel";
import { PanelBlockHeader } from "@/components/ui/panel-block-header";
import type { ClientPanel, ClientSheetContext } from "@/features/projects/serialize-panels";
import {
  buildOperatorWorkflowSteps,
  resolveOperationsSheetContext,
} from "@/lib/cut-plan/operator-operations";
import {
  applySheetSelection,
  findSheetArrayIndex,
  getSheetIndexParam,
} from "@/lib/cut-plan/panel-workspace-state";
import { getSheetIndicesForPart } from "@/lib/cut-plan/sheet-part-groups";
import { Badge } from "@/components/ui/badge";

/** Рабочее место оператора: карта + пошаговые операции на станке. */
export function PanelWorkspace({
  projectId,
  panels,
  sheetContext,
  initialSheetParam = null,
}: {
  projectId: string;
  panels: ClientPanel[];
  sheetContext: ClientSheetContext | null;
  initialSheetParam?: string | null;
}) {
  return (
    <div className="h-full min-h-0">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
            Загрузка...
          </div>
        }
      >
        <PanelWorkspaceInner
          projectId={projectId}
          panels={panels}
          sheetContext={sheetContext}
          initialSheetParam={initialSheetParam}
        />
      </Suspense>
    </div>
  );
}

function PanelWorkspaceInner({
  projectId: _projectId,
  panels,
  sheetContext,
  initialSheetParam,
}: {
  projectId: string;
  panels: ClientPanel[];
  sheetContext: ClientSheetContext | null;
  initialSheetParam: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sheetFromUrl = searchParams.get("sheet") ?? initialSheetParam;

  const allParts = useMemo(
    () => panels.flatMap((panel) => panel.parts),
    [panels],
  );
  const cutPlan =
    panels.find((panel) => panel.cutPlans[0])?.cutPlans[0] ?? null;
  const cutPlanId = cutPlan?.id ?? null;

  const { sheetIdx, groupedPartId } = useMemo(() => {
    if (!cutPlan?.sheets.length) {
      return { sheetIdx: 0, groupedPartId: null as string | null };
    }

    const arrayIndex = findSheetArrayIndex(cutPlan.sheets, sheetFromUrl);
    return applySheetSelection(allParts, cutPlan.sheets, arrayIndex);
  }, [allParts, cutPlan, cutPlanId, sheetFromUrl]);

  const activeSheet = cutPlan?.sheets[sheetIdx] ?? cutPlan?.sheets[0] ?? null;

  function replaceWorkspaceQuery(next: { sheet: number }) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("panel");
    params.set("sheet", String(next.sheet));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  useEffect(() => {
    if (!cutPlan?.sheets.length) return;

    const sheetNumber = getSheetIndexParam(cutPlan.sheets, sheetIdx);
    if (sheetNumber === null || sheetFromUrl === String(sheetNumber)) return;

    replaceWorkspaceQuery({ sheet: sheetNumber });
  }, [cutPlan, cutPlanId, sheetFromUrl, sheetIdx]);

  const sheetWorkflowSteps = activeSheet
    ? buildOperatorWorkflowSteps(activeSheet.operations, activeSheet.placements)
    : [];

  const operationsSheetContext = activeSheet
    ? resolveOperationsSheetContext(activeSheet, allParts)
    : null;

  const activePartId = activeSheet?.placements[0]?.partId ?? null;

  const groupedSheetIndices = useMemo(() => {
    if (!groupedPartId || !cutPlan) return null;

    const part = allParts.find((item) => item.id === groupedPartId);
    if (!part || part.quantity < 2) return null;

    const indices = getSheetIndicesForPart(cutPlan.sheets, groupedPartId);
    return indices.length >= 2 ? indices : null;
  }, [allParts, cutPlan, groupedPartId]);

  function handlePartSelect(partId: string) {
    if (!cutPlan) return;

    const sheetIndices = getSheetIndicesForPart(cutPlan.sheets, partId);
    const firstSheet = cutPlan.sheets[sheetIndices[0] ?? -1];
    if (!firstSheet) return;

    replaceWorkspaceQuery({ sheet: firstSheet.sheetIndex });
  }

  function handleSheetIndexChange(index: number) {
    if (!cutPlan) return;

    const sheetNumber = getSheetIndexParam(cutPlan.sheets, index);
    if (sheetNumber === null) return;

    replaceWorkspaceQuery({ sheet: sheetNumber });
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-1.5 lg:px-4">
        {sheetContext ? (
          <p className="text-sm font-medium text-foreground">{sheetContext.label}</p>
        ) : null}

        {cutPlan ? (
          <>
            <Badge variant="outline">{cutPlan.totalSheetsCount} листов</Badge>
            <Badge variant="outline">
              Отход {Number(cutPlan.wastePercent ?? 0).toFixed(1)}%
            </Badge>
          </>
        ) : (
          <Badge variant="outline">Задание не готово</Badge>
        )}
        <div className="ml-auto flex items-center gap-2">
          {cutPlan ? (
            <OperationsSheet steps={sheetWorkflowSteps} context={operationsSheetContext} />
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-2 lg:flex-row lg:gap-3 lg:p-3">
        <aside className="flex h-full min-h-0 shrink-0 flex-col overflow-hidden rounded-xl border bg-card lg:w-[300px]">
          <PanelBlockHeader>
            <h2 className="text-sm font-medium">Детали в задании</h2>
          </PanelBlockHeader>
          <div className="min-h-0 flex-1 overflow-auto">
            <PartsPanel
              parts={allParts}
              activePartId={activePartId}
              onPartSelect={handlePartSelect}
              sheetWidthMm={sheetContext?.sheetWidthMm}
              sheetHeightMm={sheetContext?.sheetHeightMm}
            />
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {!activeSheet || !cutPlan ? (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              Сменное задание ещё не загружено
            </div>
          ) : (
            <SheetTabsPanel
              sheets={cutPlan.sheets}
              parts={allParts}
              activeIndex={sheetIdx}
              onActiveIndexChange={handleSheetIndexChange}
              groupedSheetIndices={groupedSheetIndices}
            />
          )}
        </section>
      </div>
    </div>
  );
}
