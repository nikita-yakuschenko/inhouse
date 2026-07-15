"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
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
  kerfLabel,
}: {
  machineId: string;
  machineName: string;
  /** Уже отформатированная строка: «3,5» */
  kerfLabel: string;
}) {
  const router = useRouter();
  const nameId = useId();
  const kerfId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const kerfRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) setFormKey((key) => key + 1);
  }, [open]);

  function handleSave() {
    const nextName = nameRef.current?.value.trim() ?? "";
    const kerfRaw = kerfRef.current?.value ?? "";

    if (!nextName) {
      toast.error("Укажите название");
      return;
    }

    const formData = new FormData();
    formData.set("id", machineId);
    formData.set("name", nextName);
    formData.set("defaultKerfMm", kerfRaw);

    startTransition(async () => {
      const result = await updateMachineProfileAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setOpen(false);
      toast.success("Оборудование обновлено", {
        description: `${result.name} · пропил ${result.kerfMm.replace(".", ",")} мм`,
      });
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

        <div key={formKey} className="grid gap-4 py-1">
          <div className="grid gap-2">
            <Label htmlFor={nameId}>Название</Label>
            <Input
              ref={nameRef}
              id={nameId}
              name="name"
              defaultValue={machineName}
              disabled={pending}
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={kerfId}>Ширина пропила, мм</Label>
            <Input
              ref={kerfRef}
              id={kerfId}
              name="defaultKerfMm"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              defaultValue={kerfLabel}
              disabled={pending}
              placeholder="3,5"
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
