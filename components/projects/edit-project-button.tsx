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
import { updateProjectNameAction } from "@/features/projects/actions";

type EditProjectButtonProps = {
  projectId: string;
  projectName: string;
};

export function EditProjectButton({ projectId, projectName }: EditProjectButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(projectName);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) setName(projectName);
  }, [open, projectName]);

  function handleSave() {
    const nextName = name.trim();
    if (!nextName) {
      toast.error("Укажите название проекта");
      return;
    }

    if (nextName === projectName) {
      setOpen(false);
      return;
    }

    startTransition(async () => {
      const result = await updateProjectNameAction(projectId, nextName);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setOpen(false);
      toast.success("Название обновлено", {
        description: result.name,
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
          aria-label={`Редактировать «${projectName}»`}
          title="Редактировать"
          disabled={pending}
          onClick={(event) => {
            event.stopPropagation();
          }}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <IconPencil className="size-4" stroke={1.75} />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Редактировать расчёт</AlertDialogTitle>
          <AlertDialogDescription>
            Измените название расчёта. Остальные параметры остаются без изменений.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-2 py-1">
          <Label htmlFor={`project-name-${projectId}`}>Название</Label>
          <Input
            id={`project-name-${projectId}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={pending}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleSave();
              }
            }}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Отмена</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending || !name.trim()}
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
