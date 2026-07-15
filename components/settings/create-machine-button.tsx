"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconPlus } from "@tabler/icons-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createMachineProfileAction } from "@/features/machines/actions";

export function CreateMachineButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kerf, setKerf] = useState("4");
  const [pending, startTransition] = useTransition();

  function resetForm() {
    setName("");
    setKerf("4");
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetForm();
  }

  function handleCreate() {
    const nextName = name.trim();
    if (!nextName) {
      toast.error("Укажите название");
      return;
    }

    const formData = new FormData();
    formData.set("name", nextName);
    formData.set("defaultKerfMm", kerf.replace(",", "."));

    startTransition(async () => {
      const result = await createMachineProfileAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setOpen(false);
      resetForm();
      toast.success("Оборудование добавлено", { description: result.name });
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button type="button">
          <IconPlus className="size-4" />
          Добавить
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Новое оборудование</AlertDialogTitle>
          <AlertDialogDescription>
            Укажите название станка и ширину пропила.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-4 py-1">
          <div className="grid gap-2">
            <Label htmlFor="create-machine-name">Название</Label>
            <Input
              id="create-machine-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Вертикальный форматно-раскроечный станок"
              disabled={pending}
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="create-machine-kerf">Ширина пропила, мм</Label>
            <Input
              id="create-machine-kerf"
              type="number"
              min={0}
              step={0.1}
              value={kerf}
              onChange={(event) => setKerf(event.target.value)}
              disabled={pending}
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Отмена</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              handleCreate();
            }}
          >
            {pending ? "Добавление…" : "Добавить"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
