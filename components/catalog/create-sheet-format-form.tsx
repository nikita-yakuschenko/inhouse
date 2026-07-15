"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { Material } from "@/app/generated/prisma/client";
import { createSheetFormatAction } from "@/features/catalog/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const fieldClassName = cn(
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none",
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

export function CreateSheetFormatForm({ materials }: { materials: Material[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (materials.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        Сначала добавьте материал на странице «Материалы».
      </div>
    );
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createSheetFormatAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Формат листа добавлен", { description: result.name });
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="grid gap-4 rounded-xl border bg-card p-6 sm:grid-cols-2 lg:grid-cols-5">
      <div className="grid gap-2 sm:col-span-2">
        <Label htmlFor="sheet-material">Материал</Label>
        <select
          id="sheet-material"
          name="materialId"
          required
          defaultValue={materials[0]?.id}
          className={fieldClassName}
          disabled={pending}
        >
          {materials.map((material) => (
            <option key={material.id} value={material.id}>
              {material.name} ({material.thicknessMm} мм)
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="sheet-width">Ширина, мм</Label>
        <Input
          id="sheet-width"
          name="widthMm"
          type="number"
          required
          min={1}
          placeholder="1250"
          disabled={pending}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="sheet-height">Высота, мм</Label>
        <Input
          id="sheet-height"
          name="heightMm"
          type="number"
          required
          min={1}
          placeholder="3000"
          disabled={pending}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="sheet-name">Название (необязательно)</Label>
        <Input
          id="sheet-name"
          name="name"
          placeholder="1250×3000"
          disabled={pending}
        />
      </div>
      <div className="flex items-end sm:col-span-2 lg:col-span-5">
        <Button type="submit" disabled={pending}>
          {pending ? "Сохранение…" : "Добавить формат"}
        </Button>
      </div>
    </form>
  );
}
