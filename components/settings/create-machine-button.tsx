"use client";

import { useId, useRef, useState, useTransition } from "react";
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
  const nameId = useId();
  const kerfId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const kerfRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setFormKey((key) => key + 1);
  }

  function handleCreate() {
    const nextName = nameRef.current?.value.trim() ?? "";
    const kerfRaw = kerfRef.current?.value ?? "";

    if (!nextName) {
      toast.error("Укажите название");
      return;
    }

    const formData = new FormData();
    formData.set("name", nextName);
    formData.set("defaultKerfMm", kerfRaw);

    startTransition(async () => {
      const result = await createMachineProfileAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setOpen(false);
      toast.success("Оборудование добавлено", {
        description: `${result.name} · пропил ${result.kerfMm.replace(".", ",")} мм`,
      });
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

        <div key={formKey} className="grid gap-4 py-1">
          <div className="grid gap-2">
            <Label htmlFor={nameId}>Название</Label>
            <Input
              ref={nameRef}
              id={nameId}
              name="name"
              defaultValue=""
              placeholder="Вертикальный форматно-раскроечный станок"
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
              defaultValue="4"
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
