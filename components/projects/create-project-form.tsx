"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createProjectAction } from "@/features/projects/actions";
import type { MachineProfile, Material, SheetFormat } from "@/app/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const fieldClassName = cn(
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none",
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

export function CreateProjectForm({
  materials: _materials,
  sheetFormats,
  machineProfiles,
  submitLabel = "Создать проект",
}: {
  materials: Material[];
  sheetFormats: (SheetFormat & { material: Material })[];
  machineProfiles: MachineProfile[];
  submitLabel?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const catalogReady = sheetFormats.length > 0 && machineProfiles.length > 0;

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
          Добавьте материал в «Справочники → Материалы» и убедитесь, что есть профиль
          станка.
        </p>
      </div>
    );
  }

  function handleSubmit(formData: FormData) {
    const sheetFormatId = String(formData.get("sheetFormatId") ?? "");
    const sheet = sheetFormats.find((item) => item.id === sheetFormatId);
    if (sheet) {
      formData.set("materialId", sheet.materialId);
    }

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
        <Label htmlFor="name">Название проекта</Label>
        <Input
          id="name"
          name="name"
          required
          placeholder="Например, ГКЛ офис 204"
          disabled={pending}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="sheetFormatId">Материал</Label>
          <select
            id="sheetFormatId"
            name="sheetFormatId"
            required
            defaultValue={defaultSheet}
            className={fieldClassName}
            disabled={pending}
          >
            {sheetFormats.map((sheet) => (
              <option key={sheet.id} value={sheet.id}>
                {sheet.material.name} · {sheet.widthMm}×{sheet.heightMm}×{sheet.thicknessMm}
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
            disabled={pending}
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
          disabled={pending}
        />
      </div>

      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? "Создание…" : submitLabel}
      </Button>
    </form>
  );
}
