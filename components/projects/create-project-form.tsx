import { createProjectAction } from "@/features/projects/actions";
import type { MachineProfile, Material, SheetFormat } from "@/app/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const fieldClassName = cn(
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none",
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50"
);

export function CreateProjectForm({
  materials,
  sheetFormats,
  machineProfiles,
}: {
  materials: Material[];
  sheetFormats: (SheetFormat & { material: Material })[];
  machineProfiles: MachineProfile[];
}) {
  const catalogReady =
    materials.length > 0 && sheetFormats.length > 0 && machineProfiles.length > 0;

  const defaultMaterial = materials[0]?.id ?? "";
  const defaultSheet =
    sheetFormats.find((sheet) => sheet.isDefault)?.id ?? sheetFormats[0]?.id ?? "";
  const defaultMachine =
    machineProfiles.find((machine) => machine.isDefault)?.id ??
    machineProfiles[0]?.id ??
    "";

  if (!catalogReady) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
        <h3 className="text-base font-semibold">Справочники не загружены</h3>
        <p className="mt-2">
          Форма создания проекта пустая, потому что в базе нет материалов, форматов
          листов и профилей станков.
        </p>
        <p className="mt-3 font-medium">Выполните в терминале:</p>
        <pre className="mt-2 overflow-x-auto rounded-md bg-white p-3 text-xs text-slate-800">
{`docker compose up -d
npx prisma db push
npm run db:seed`}
        </pre>
        <p className="mt-3">
          После этого обновите страницу — в выпадающих списках появятся значения.
        </p>
      </div>
    );
  }

  return (
    <form action={createProjectAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Название проекта</Label>
        <Input
          id="name"
          name="name"
          required
          placeholder="Например, ГКЛ офис 204"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="customerName">Заказчик</Label>
          <Input id="customerName" name="customerName" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="materialId">Материал</Label>
          <select
            id="materialId"
            name="materialId"
            required
            defaultValue={defaultMaterial}
            className={fieldClassName}
          >
            {materials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="sheetFormatId">Формат листа</Label>
          <select
            id="sheetFormatId"
            name="sheetFormatId"
            required
            defaultValue={defaultSheet}
            className={fieldClassName}
          >
            {sheetFormats.map((sheet) => (
              <option key={sheet.id} value={sheet.id}>
                {sheet.name} ({sheet.widthMm}×{sheet.heightMm})
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="machineProfileId">Станок</Label>
          <select
            id="machineProfileId"
            name="machineProfileId"
            required
            defaultValue={defaultMachine}
            className={fieldClassName}
          >
            {machineProfiles.map((machine) => (
              <option key={machine.id} value={machine.id}>
                {machine.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="description">Описание</Label>
        <textarea
          id="description"
          name="description"
          rows={3}
          className={cn(fieldClassName, "h-auto min-h-20 py-2")}
        />
      </div>

      <Button type="submit" className="w-fit">
        Создать проект
      </Button>
    </form>
  );
}
