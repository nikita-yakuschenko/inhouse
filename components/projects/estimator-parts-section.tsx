import { createPartAction, deletePartAction } from "@/features/parts/actions";
import type { ClientPart } from "@/features/projects/serialize-panels";
import { ImportPartsButton } from "@/components/projects/import-parts-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { partitionPartsByWorkType } from "@/lib/parts/part-work-type";
import { IconTrash } from "@tabler/icons-react";

function PartsTable({
  projectId,
  parts,
}: {
  projectId: string;
  parts: ClientPart[];
}) {
  if (parts.length === 0) {
    return (
      <p className="px-6 py-8 text-center text-sm text-muted-foreground">Нет деталей</p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">Марка</TableHead>
          <TableHead>Код</TableHead>
          <TableHead className="text-right">Ширина, мм</TableHead>
          <TableHead className="text-right">Высота, мм</TableHead>
          <TableHead className="text-right">Кол-во</TableHead>
          <TableHead className="pr-6 text-right"> </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {parts.map((part) => (
          <TableRow key={part.id}>
            <TableCell className="pl-6 font-medium">{part.name}</TableCell>
            <TableCell className="text-muted-foreground">{part.code ?? "—"}</TableCell>
            <TableCell className="text-right tabular-nums">{part.widthMm}</TableCell>
            <TableCell className="text-right tabular-nums">{part.heightMm}</TableCell>
            <TableCell className="text-right tabular-nums">{part.quantity}</TableCell>
            <TableCell className="pr-6 text-right">
              <form action={deletePartAction}>
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="partId" value={part.id} />
                <button
                  type="submit"
                  className="inline-flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  aria-label={`Удалить «${part.name}»`}
                  title="Удалить"
                >
                  <IconTrash className="size-4" stroke={1.75} />
                </button>
              </form>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PartsGroup({
  title,
  description,
  projectId,
  parts,
}: {
  title: string;
  description: string;
  projectId: string;
  parts: ClientPart[];
}) {
  if (parts.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b px-6 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <PartsTable projectId={projectId} parts={parts} />
    </div>
  );
}

export function EstimatorPartsSection({
  projectId,
  panelId,
  parts,
  sheetWidthMm,
  sheetHeightMm,
}: {
  projectId: string;
  panelId: string;
  parts: ClientPart[];
  sheetWidthMm?: number | null;
  sheetHeightMm?: number | null;
}) {
  const { cuttingAndMarking, markingOnly } = partitionPartsByWorkType(
    parts,
    sheetWidthMm,
    sheetHeightMm,
  );

  return (
    <div className="flex flex-col gap-6">
      <form
        action={createPartAction}
        className="grid gap-4 rounded-xl border bg-card p-6 sm:grid-cols-2 lg:grid-cols-6"
      >
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="panelId" value={panelId} />

        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="part-name">Марка</Label>
          <Input id="part-name" name="name" required placeholder="Боковина левая" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="part-code">Код</Label>
          <Input id="part-code" name="code" placeholder="01" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="part-width">Ширина, мм</Label>
          <Input id="part-width" name="widthMm" type="number" required min={1} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="part-height">Высота, мм</Label>
          <Input id="part-height" name="heightMm" type="number" required min={1} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="part-qty">Кол-во</Label>
          <Input id="part-qty" name="quantity" type="number" required min={1} defaultValue={1} />
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6">
          <Button type="submit">Добавить деталь</Button>
          <ImportPartsButton projectId={projectId} />
        </div>
      </form>

      {parts.length === 0 ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            Добавьте детали для расчёта раскроя
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <PartsGroup
            title="Раскрой и маркировка"
            description="Детали меньше листа — участвуют в раскрое"
            projectId={projectId}
            parts={cuttingAndMarking}
          />
          <PartsGroup
            title="Только маркировка"
            description="Размер совпадает с листом — резка не нужна"
            projectId={projectId}
            parts={markingOnly}
          />
        </div>
      )}
    </div>
  );
}
