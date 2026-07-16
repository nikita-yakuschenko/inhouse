"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createProjectAction } from "@/features/projects/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { projectKindSelectLabel } from "@/lib/projects/project-kind";
import { cn } from "@/lib/utils";

export type CatalogMaterialOption = {
  id: string;
  name: string;
};

export type CatalogSheetFormatOption = {
  id: string;
  materialId: string;
  isDefault: boolean;
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
  material: { name: string };
};

export type CatalogMachineOption = {
  id: string;
  name: string;
  isDefault: boolean;
};

const fieldClassName = cn(
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none",
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

const selectChevron =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

const selectClassName = cn(
  fieldClassName,
  "cursor-pointer appearance-none bg-no-repeat pr-9",
  "bg-[length:12px_12px] bg-[position:right_12px_center]",
);

export function CreateProjectForm({
  materials: _materials,
  sheetFormats: _sheetFormats,
  machineProfiles,
  submitLabel = "Создать проект",
}: {
  materials: CatalogMaterialOption[];
  sheetFormats: CatalogSheetFormatOption[];
  machineProfiles: CatalogMachineOption[];
  submitLabel?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<"sheet" | "bar">("sheet");

  const defaultMachine =
    machineProfiles.find((machine) => machine.isDefault)?.id ??
    machineProfiles[0]?.id ??
    "";

  function handleSubmit(formData: FormData) {
    formData.set("kind", kind);

    startTransition(async () => {
      const result = await createProjectAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Расчёт создан", {
        description: result.name,
      });
      router.push(`/projects/${result.projectId}`);
    });
  }

  return (
    <form action={handleSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="kind">Вид раскроя</Label>
        <select
          id="kind"
          name="kind"
          className={selectClassName}
          style={{ backgroundImage: selectChevron }}
          value={kind}
          onChange={(e) => setKind(e.target.value as "sheet" | "bar")}
          disabled={pending}
        >
          <option value="sheet">{projectKindSelectLabel("sheet")}</option>
          <option value="bar">{projectKindSelectLabel("bar")}</option>
        </select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="name">
          {kind === "bar" ? "Название расчёта" : "Заводской номер домокомплекта"}
        </Label>
        <Input
          id="name"
          name="name"
          required
          placeholder={kind === "bar" ? "Например, Погонаж 356" : "Например, ДК-2026-014"}
          disabled={pending}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="contractNumber">Номер договора</Label>
        <Input
          id="contractNumber"
          name="contractNumber"
          required
          placeholder="Например, Д-45/26"
          disabled={pending}
        />
      </div>

      {kind === "sheet" && (
        <>
          <div className="grid gap-2">
            <Label htmlFor="technology">Технология</Label>
            <select
              id="technology"
              name="technology"
              required
              defaultValue=""
              className={selectClassName}
              style={{ backgroundImage: selectChevron }}
              disabled={pending}
            >
              <option value="" disabled>
                Выберите технологию
              </option>
              <option value="pkd">ПКД (панельно-каркасная)</option>
              <option value="md">МД (модульная)</option>
            </select>
          </div>

          {machineProfiles.length > 0 ? (
            <div className="grid gap-2">
              <Label htmlFor="machineProfileId">Станок</Label>
              <select
                id="machineProfileId"
                name="machineProfileId"
                defaultValue={defaultMachine}
                className={selectClassName}
                style={{ backgroundImage: selectChevron }}
                disabled={pending}
              >
                {machineProfiles.map((machine) => (
                  <option key={machine.id} value={machine.id}>
                    {machine.name}
                  </option>
                ))}
              </select>
              <p className="text-muted-foreground text-xs">
                Материал выбирается в проекте перед раскроем — его можно сменить
                в любой момент.
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              Материал и станок можно указать в проекте перед раскроем. Добавьте
              станок в «Справочники», если его ещё нет.
            </p>
          )}
        </>
      )}

      <div className="grid gap-2">
        <Label htmlFor="description">Описание</Label>
        <textarea
          id="description"
          name="description"
          rows={3}
          className={cn(fieldClassName, "h-auto min-h-20 py-2")}
          disabled={pending}
        />
      </div>

      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? "Создание…" : submitLabel}
      </Button>
    </form>
  );
}
