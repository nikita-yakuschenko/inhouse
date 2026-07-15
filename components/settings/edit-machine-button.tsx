"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconPencil } from "@tabler/icons-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateMachineProfileAction } from "@/features/machines/actions";

export function EditMachineButton({
  machineId,
  machineName,
  kerfMm,
}: {
  machineId: string;
  machineName: string;
  kerfMm: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(machineName);
  const [kerf, setKerf] = useState(String(kerfMm));
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setName(machineName);
      setKerf(String(kerfMm));
    }
  }, [open, machineName, kerfMm]);

  function handleSave() {
    const nextName = name.trim();
    if (!nextName) {
      toast.error("Укажите название");
      return;
    }

    const formData = new FormData();
    formData.set("id", machineId);
    formData.set("name", nextName);
    formData.set("defaultKerfMm", kerf.replace(",", "."));

    startTransition(async () => {
      const result = await updateMachineProfileAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setOpen(false);
      toast.success("Оборудование обновлено", { description: result.name });
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
          aria-label={`Редактировать «${machineName}»`}
          title="Редактировать"
          disabled={pending}
        >
          <IconPencil className="size-4" stroke={1.75} />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Редактировать оборудование</AlertDialogTitle>
          <AlertDialogDescription>
            Измените название станка или ширину пропила.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-4 py-1">
          <div className="grid gap-2">
            <Label htmlFor={`edit-name-${machineId}`}>Название</Label>
            <Input
              id={`edit-name-${machineId}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={pending}
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`edit-kerf-${machineId}`}>Ширина пропила, мм</Label>
            <Input
              id={`edit-kerf-${machineId}`}
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
              handleSave();
            }}
          >
            {pending ? "Сохранение…" : "Сохранить"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
