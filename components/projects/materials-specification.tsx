import type {
  ClientCutPlan,
  ClientPart,
  ClientSheetContext,
} from "@/features/projects/serialize-panels";
import { buildMaterialsSpecSummary } from "@/lib/cut-plan/materials-spec";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function MaterialsSpecification({
  sheetContext,
  parts,
  cutPlan,
}: {
  sheetContext: ClientSheetContext | null;
  parts: ClientPart[];
  cutPlan: ClientCutPlan | null;
}) {
  const spec = buildMaterialsSpecSummary(sheetContext, parts, cutPlan);

  if (!spec || !sheetContext) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        Укажите материал и формат листа в проекте — спецификация появится здесь
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-semibold">Спецификация материалов</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Ведомость листовых материалов к заказу: раскрой + целые листы под маркировку.
          Отход — по метрике раскроя (маркировочные листы с нулевым отходом не меняют процент).
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">№</TableHead>
              <TableHead>Материал</TableHead>
              <TableHead>Формат</TableHead>
              <TableHead className="text-right">Толщина, мм</TableHead>
              <TableHead className="text-right">Листов</TableHead>
              <TableHead className="text-right">Площадь листов</TableHead>
              <TableHead className="text-right">Площадь деталей</TableHead>
              <TableHead className="pr-6 text-right">Отход</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="pl-6 tabular-nums">1</TableCell>
              <TableCell className="font-medium">{spec.materialName}</TableCell>
              <TableCell className="tabular-nums">{spec.formatLabel}</TableCell>
              <TableCell className="text-right tabular-nums">
                {spec.thicknessLabel}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {spec.sheetsCount ?? "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {spec.sheetsAreaLabel ?? "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {spec.partsAreaLabel ?? "—"}
              </TableCell>
              <TableCell className="pr-6 text-right tabular-nums">
                {spec.wastePercentLabel ?? "—"}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        {spec.markingSheets > 0 ? (
          <p className="border-t px-6 py-3 text-sm text-muted-foreground">
            В том числе целых листов под маркировку без раскроя: {spec.markingSheets}
            {spec.hasCutPlan
              ? ` · листов в раскрое: ${spec.cuttingSheets}`
              : " · раскрой ещё не рассчитан"}
          </p>
        ) : !spec.hasCutPlan ? (
          <p className="border-t px-6 py-3 text-sm text-muted-foreground">
            Раскрой не рассчитан — количество листов раскроя появится после расчёта
          </p>
        ) : null}
      </div>
    </div>
  );
}
