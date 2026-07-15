"use client";

import { Suspense, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { CalculateProjectButton } from "@/components/cut-plan/calculate-project-button";
import { ExportCutPlanPdfButton } from "@/components/cut-plan/export-cut-plan-pdf-button";
import { SheetTabsPanel } from "@/components/cut-plan/sheet-tabs-panel";
import { EstimatorPartsSection } from "@/components/projects/estimator-parts-section";
import { MaterialsSpecification } from "@/components/projects/materials-specification";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ClientCutPlan, ClientPanel, ClientSheetContext } from "@/features/projects/serialize-panels";
import {
  applySheetSelection,
  findSheetArrayIndex,
  getSheetIndexParam,
} from "@/lib/cut-plan/panel-workspace-state";
import { getSheetIndicesForPart } from "@/lib/cut-plan/sheet-part-groups";
import { buildMaterialsSpecSummary } from "@/lib/cut-plan/materials-spec";
import { totalMaterialSheetsCount } from "@/lib/parts/part-work-type";

const ESTIMATOR_TABS = ["parts", "cut", "spec"] as const;
type EstimatorTab = (typeof ESTIMATOR_TABS)[number];

function isEstimatorTab(value: string | null | undefined): value is EstimatorTab {
  return ESTIMATOR_TABS.includes(value as EstimatorTab);
}

/** Старые ссылки ?tab=ops → Спецификация */
function resolveEstimatorTab(value: string | null | undefined): EstimatorTab | null {
  if (value === "ops" || value === "operations") return "spec";
  if (isEstimatorTab(value)) return value;
  return null;
}

export function EstimatorWorkspace({
  projectId,
  projectName,
  contractNumber = null,
  panels,
  sheetContext,
  initialSheetParam = null,
}: {
  projectId: string;
  projectName: string;
  contractNumber?: string | null;
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
        <EstimatorWorkspaceInner
          projectId={projectId}
          projectName={projectName}
          contractNumber={contractNumber}
          panels={panels}
          sheetContext={sheetContext}
          initialSheetParam={initialSheetParam}
        />
      </Suspense>
    </div>
  );
}

function EstimatorWorkspaceInner({
  projectId,
  projectName,
  contractNumber,
  panels,
  sheetContext,
  initialSheetParam,
}: {
  projectId: string;
  projectName: string;
  contractNumber: string | null;
  panels: ClientPanel[];
  sheetContext: ClientSheetContext | null;
  initialSheetParam: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sheetFromUrl = searchParams.get("sheet") ?? initialSheetParam;
  const tabFromUrl = searchParams.get("tab");

  // Проект = один список деталей; марка стены только в коде (Ст-1-02-01).
  const primaryPanel = panels[0]!;
  const allParts = useMemo(
    () => panels.flatMap((panel) => panel.parts),
    [panels],
  );
  const cutPlan =
    panels.find((panel) => panel.cutPlans[0])?.cutPlans[0] ?? null;
  const cutPlanId = cutPlan?.id ?? null;

  const activeTab: EstimatorTab =
    resolveEstimatorTab(tabFromUrl) ?? (cutPlan ? "cut" : "parts");

  const { sheetIdx, groupedPartId } = useMemo(() => {
    if (!cutPlan?.sheets.length) {
      return { sheetIdx: 0, groupedPartId: null as string | null };
    }

    const arrayIndex = findSheetArrayIndex(cutPlan.sheets, sheetFromUrl);
    return applySheetSelection(allParts, cutPlan.sheets, arrayIndex);
  }, [allParts, cutPlan, cutPlanId, sheetFromUrl]);

  const activeSheet = cutPlan?.sheets[sheetIdx] ?? cutPlan?.sheets[0] ?? null;

  function replaceQuery(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  useEffect(() => {
    if (!cutPlan?.sheets.length) return;

    const sheetNumber = getSheetIndexParam(cutPlan.sheets, sheetIdx);
    if (sheetNumber === null || sheetFromUrl === String(sheetNumber)) return;

    replaceQuery({
      sheet: String(sheetNumber),
      panel: null,
    });
  }, [cutPlan, cutPlanId, sheetFromUrl, sheetIdx]);

  const groupedSheetIndices = useMemo(() => {
    if (!groupedPartId || !cutPlan) return null;

    const part = allParts.find((item) => item.id === groupedPartId);
    if (!part || part.quantity < 2) return null;

    const indices = getSheetIndicesForPart(cutPlan.sheets, groupedPartId);
    return indices.length >= 2 ? indices : null;
  }, [allParts, cutPlan, groupedPartId]);

  function handleSheetIndexChange(index: number) {
    if (!cutPlan) return;

    const sheetNumber = getSheetIndexParam(cutPlan.sheets, index);
    if (sheetNumber === null) return;

    replaceQuery({
      sheet: String(sheetNumber),
      tab: "cut",
      panel: null,
    });
  }

  function handleTabChange(value: string) {
    replaceQuery({ tab: value });
  }

  const materialSheetsCount = useMemo(
    () =>
      totalMaterialSheetsCount(
        cutPlan?.totalSheetsCount ?? 0,
        allParts,
        sheetContext?.sheetWidthMm,
        sheetContext?.sheetHeightMm,
      ),
    [allParts, cutPlan?.totalSheetsCount, sheetContext],
  );

  const projectTitle = contractNumber
    ? `${projectName} · ${contractNumber}`
    : projectName;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3 lg:px-6">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{projectTitle}</p>
          <p className="text-xs text-muted-foreground">{allParts.length} дет.</p>
        </div>

        {cutPlan || materialSheetsCount > 0 ? (
          <>
            <Badge variant="secondary">{materialSheetsCount} листов</Badge>
            {cutPlan ? (
              <Badge variant="secondary">
                Отход {Number(cutPlan.wastePercent ?? 0).toFixed(1)}%
              </Badge>
            ) : null}
          </>
        ) : (
          <Badge variant="outline">Раскрой не рассчитан</Badge>
        )}

        <div className="ml-auto flex items-center gap-2">
          <ExportCutPlanPdfButton
            meta={{
              projectName,
              projectId,
              contractNumber,
              materialLabel: sheetContext?.label ?? null,
              sheetWidthMm: sheetContext?.sheetWidthMm ?? null,
              sheetHeightMm: sheetContext?.sheetHeightMm ?? null,
              materialsSpec: buildMaterialsSpecSummary(
                sheetContext,
                allParts,
                cutPlan,
              ),
            }}
            panels={panels}
          />
          <CalculateProjectButton projectId={projectId} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex h-full min-h-0 flex-col">
          <TabsList>
            <TabsTrigger value="parts">Детали</TabsTrigger>
            <TabsTrigger value="cut">Карта раскроя</TabsTrigger>
            <TabsTrigger value="spec">Спецификация</TabsTrigger>
          </TabsList>

          <TabsContent value="parts" className="mt-4 min-h-0 flex-1">
            <EstimatorPartsSection
              projectId={projectId}
              panelId={primaryPanel.id}
              parts={allParts}
              sheetWidthMm={sheetContext?.sheetWidthMm}
              sheetHeightMm={sheetContext?.sheetHeightMm}
            />
          </TabsContent>

          <TabsContent value="cut" className="mt-4 min-h-0 flex-1">
            {!cutPlan ? (
              <div className="flex h-[min(24rem,60vh)] items-center justify-center rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                Выполните расчёт — карта раскроя появится на этой вкладке
              </div>
            ) : !activeSheet ? (
              <div className="flex h-[min(24rem,60vh)] flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                <CutPlanSummary
                  cutPlan={cutPlan}
                  materialSheetsCount={materialSheetsCount}
                />
                <p>Деталей для раскроя нет — только целые листы под маркировку</p>
              </div>
            ) : (
              <div className="flex h-[min(48rem,calc(100vh-16rem))] min-h-96 flex-col gap-4">
                <CutPlanSummary
                  cutPlan={cutPlan}
                  materialSheetsCount={materialSheetsCount}
                />
                <div className="min-h-0 flex-1 overflow-hidden rounded-xl border">
                  <SheetTabsPanel
                    sheets={cutPlan.sheets}
                    parts={allParts}
                    activeIndex={sheetIdx}
                    onActiveIndexChange={handleSheetIndexChange}
                    groupedSheetIndices={groupedSheetIndices}
                  />
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="spec" className="mt-4 min-h-0 flex-1">
            <MaterialsSpecification
              sheetContext={sheetContext}
              parts={allParts}
              cutPlan={cutPlan}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function CutPlanSummary({
  cutPlan,
  materialSheetsCount,
}: {
  cutPlan: ClientCutPlan;
  materialSheetsCount: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card className="shadow-xs">
        <CardHeader>
          <CardDescription>Листов (заказ)</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {materialSheetsCount}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card className="shadow-xs">
        <CardHeader>
          <CardDescription>В раскрое</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {cutPlan.totalSheetsCount}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card className="shadow-xs">
        <CardHeader>
          <CardDescription>Отход (раскрой)</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {Number(cutPlan.wastePercent ?? 0).toFixed(1)}%
          </CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}
