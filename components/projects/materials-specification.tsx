import type {
  ClientCutPlan,
  ClientPart,
  ClientSheetContext,
} from "@/features/projects/serialize-panels";
import {
  markingOnlySheetsCount,
  totalMaterialSheetsCount,
} from "@/lib/parts/part-work-type";
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

  const sheetW = sheetContext.sheetWidthMm;
  const sheetH = sheetContext.sheetHeightMm;

  const sheetAreaMm2 = sheetW && sheetH ? sheetW * sheetH : null;

  const markingSheets = markingOnlySheetsCount(parts, sheetW, sheetH);
  const cuttingSheets = cutPlan?.totalSheetsCount ?? 0;
  // Целые листы под маркировку всегда в заказе; листы раскроя — после расчёта.
  const sheetsCount =
    cutPlan || markingSheets > 0
      ? totalMaterialSheetsCount(cuttingSheets, parts, sheetW, sheetH)
      : null;

  const sheetsAreaMm2 =
    sheetAreaMm2 !== null && sheetsCount !== null ? sheetAreaMm2 * sheetsCount : null;

  const partsAreaMm2 = parts.reduce(
    (sum, part) => sum + part.widthMm * part.heightMm * part.quantity,
    0,
  );

  // Отход по всей закупке: площадь листов минус площадь всех деталей.
  const wastePercent =
    sheetsAreaMm2 && sheetsAreaMm2 > 0
      ? Math.max(0, ((sheetsAreaMm2 - partsAreaMm2) / sheetsAreaMm2) * 100)
      : null;

  const formatLabel =
    sheetW && sheetH ? `${sheetW}×${sheetH}` : (sheetContext.sheetFormatName ?? "—");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-semibold">Спецификация материалов</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Ведомость листовых материалов к заказу: раскрой + целые листы под маркировку
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

        {markingSheets > 0 ? (
          <p className="border-t px-6 py-3 text-sm text-muted-foreground">
            В том числе целых листов под маркировку без раскроя: {markingSheets}
            {cutPlan
              ? ` · листов в раскрое: ${cuttingSheets}`
              : " · раскрой ещё не рассчитан"}
          </p>
        ) : !cutPlan ? (
          <p className="border-t px-6 py-3 text-sm text-muted-foreground">
            Раскрой не рассчитан — количество листов раскроя появится после расчёта
          </p>
        ) : null}
      </div>
    </div>
  );
}
