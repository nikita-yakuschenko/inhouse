import type {
  ClientCutPlan,
  ClientPart,
  ClientSheetContext,
} from "@/features/projects/serialize-panels";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatAreaM2(areaMm2: number): string {
  return `${(areaMm2 / 1_000_000).toFixed(2)} м²`;
}

export function MaterialsSpecification({
  sheetContext,
  parts,
  cutPlan,
}: {
  sheetContext: ClientSheetContext | null;
  parts: ClientPart[];
  cutPlan: ClientCutPlan | null;
}) {
  if (!sheetContext) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        Укажите материал и формат листа в проекте — спецификация появится здесь
      </div>
    );
  }

  const sheetAreaMm2 =
    sheetContext.sheetWidthMm && sheetContext.sheetHeightMm
      ? sheetContext.sheetWidthMm * sheetContext.sheetHeightMm
      : null;

  const sheetsCount = cutPlan?.totalSheetsCount ?? null;
  const sheetsAreaMm2 =
    sheetAreaMm2 !== null && sheetsCount !== null ? sheetAreaMm2 * sheetsCount : null;

  const partsAreaMm2 = parts.reduce(
    (sum, part) => sum + part.widthMm * part.heightMm * part.quantity,
    0,
  );

  const wastePercent =
    cutPlan?.wastePercent !== null && cutPlan?.wastePercent !== undefined
      ? Number(cutPlan.wastePercent)
      : sheetsAreaMm2 && sheetsAreaMm2 > 0
        ? Math.max(0, ((sheetsAreaMm2 - partsAreaMm2) / sheetsAreaMm2) * 100)
        : null;

  const formatLabel =
    sheetContext.sheetWidthMm && sheetContext.sheetHeightMm
      ? `${sheetContext.sheetWidthMm}×${sheetContext.sheetHeightMm}`
      : (sheetContext.sheetFormatName ?? "—");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-semibold">Спецификация материалов</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Ведомость листовых материалов к заказу по текущему расчёту
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
              <TableCell className="font-medium">
                {sheetContext.materialName ?? "—"}
              </TableCell>
              <TableCell className="tabular-nums">{formatLabel}</TableCell>
              <TableCell className="text-right tabular-nums">
                {sheetContext.thicknessMm != null
                  ? String(sheetContext.thicknessMm).replace(".", ",")
                  : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {sheetsCount ?? "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {sheetsAreaMm2 !== null ? formatAreaM2(sheetsAreaMm2) : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {parts.length > 0 ? formatAreaM2(partsAreaMm2) : "—"}
              </TableCell>
              <TableCell className="pr-6 text-right tabular-nums">
                {wastePercent !== null ? `${wastePercent.toFixed(1)}%` : "—"}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        {!cutPlan ? (
          <p className="border-t px-6 py-3 text-sm text-muted-foreground">
            Раскрой не рассчитан — количество листов и отход появятся после расчёта
          </p>
        ) : null}
      </div>
    </div>
  );
}
