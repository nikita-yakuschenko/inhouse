"use client";

import type {
  CutPlan,
  CutPlanSheet,
  Placement,
  CutOperation,
  PlannedOffcut,
} from "@/app/generated/prisma/client";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type SheetWithRelations = CutPlanSheet & {
  placements: Placement[];
  operations: CutOperation[];
  plannedOffcuts: PlannedOffcut[];
};

export function CutPlanMetrics({
  cutPlan,
}: {
  cutPlan: CutPlan & { sheets: SheetWithRelations[] };
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard label="Листов" value={String(cutPlan.totalSheetsCount)} />
      <MetricCard
        label="Отход"
        value={`${Number(cutPlan.wastePercent ?? 0).toFixed(1)}%`}
      />
      <MetricCard label="Операций реза" value={String(cutPlan.totalSetupChangesCount)} />
      <MetricCard
        label="Площадь деталей"
        value={`${(Number(cutPlan.totalPartsAreaMm2) / 1_000_000).toFixed(2)} м²`}
      />
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
