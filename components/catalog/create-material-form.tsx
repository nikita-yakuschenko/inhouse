"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createMaterialAction } from "@/features/catalog/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateMaterialForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createMaterialAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Материал добавлен", { description: result.name });
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="grid gap-4 rounded-xl border bg-card p-6 sm:grid-cols-2 lg:grid-cols-5">
      <input type="hidden" name="materialType" value="sheet" />
      <div className="grid gap-2 sm:col-span-2 lg:col-span-2">
        <Label htmlFor="material-name">Название</Label>
        <Input
          id="material-name"
          name="name"
          required
          placeholder="Плита ГСПВ"
          disabled={pending}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="material-thickness">Толщина, мм</Label>
        <Input
          id="material-thickness"
          name="thicknessMm"
          type="number"
          required
          min={0.1}
          step={0.1}
          placeholder="12.5"
          disabled={pending}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="material-width">Ширина листа, мм</Label>
        <Input
          id="material-width"
          name="widthMm"
          type="number"
          required
          min={1}
          placeholder="1250"
          disabled={pending}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="material-height">Длина листа, мм</Label>
        <Input
          id="material-height"
          name="heightMm"
          type="number"
          required
          min={1}
          placeholder="3000"
          disabled={pending}
        />
      </div>
      <div className="flex items-end sm:col-span-2 lg:col-span-5">
        <Button type="submit" disabled={pending}>
          {pending ? "Сохранение…" : "Добавить материал"}
        </Button>
      </div>
    </form>
  );
}
