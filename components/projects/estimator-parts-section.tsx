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
import { IconTrash } from "@tabler/icons-react";

export function EstimatorPartsSection({
  projectId,
  panelId,
  parts,
}: {
  projectId: string;
  panelId: string;
  parts: ClientPart[];
}) {
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
          <ImportPartsButton projectId={projectId} panelId={panelId} />
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border bg-card">
        {parts.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            Добавьте детали для расчёта раскроя
          </p>
        ) : (
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
        )}
      </div>
    </div>
  );
}
