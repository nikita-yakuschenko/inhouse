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
import { updateProjectAction } from "@/features/projects/actions";
import {
  PROJECT_TECHNOLOGY_OPTIONS,
  type ProjectTechnologyValue,
} from "@/lib/projects/technology";
import { cn } from "@/lib/utils";

const selectClassName = cn(
  "flex h-9 w-full appearance-none rounded-md border border-input bg-transparent px-3 py-1 pr-9 text-sm shadow-xs outline-none",
  "bg-[length:12px_12px] bg-[position:right_12px_center] bg-no-repeat",
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

const selectChevron =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

type EditProjectButtonProps = {
  projectId: string;
  factoryNumber: string;
  contractNumber: string | null;
  technology: ProjectTechnologyValue | null;
};

export function EditProjectButton({
  projectId,
  factoryNumber,
  contractNumber,
  technology,
}: EditProjectButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(factoryNumber);
  const [contract, setContract] = useState(contractNumber ?? "");
  const [tech, setTech] = useState<ProjectTechnologyValue | "">(technology ?? "");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setName(factoryNumber);
    setContract(contractNumber ?? "");
    setTech(technology ?? "");
  }, [open, factoryNumber, contractNumber, technology]);

  function handleSave() {
    const nextName = name.trim();
    const nextContract = contract.trim();

    if (!nextName) {
      toast.error("Укажите заводской номер домокомплекта");
      return;
    }
    if (!nextContract) {
      toast.error("Укажите номер договора");
      return;
    }
    const needsTechnology = technology === "pkd" || technology === "md";
    if (needsTechnology && tech !== "pkd" && tech !== "md") {
      toast.error("Выберите технологию");
      return;
    }

    if (
      nextName === factoryNumber &&
      nextContract === (contractNumber ?? "") &&
      tech === (technology ?? "")
    ) {
      setOpen(false);
      return;
    }

    startTransition(async () => {
      const result = await updateProjectAction({
        projectId,
        name: nextName,
        contractNumber: nextContract,
        technology: needsTechnology ? tech : null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setOpen(false);
      toast.success("Расчёт обновлён", {
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
          aria-label={`Редактировать «${factoryNumber}»`}
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
            Измените реквизиты расчёта. Материал и станок остаются без изменений.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-3 py-1">
          <div className="grid gap-2">
            <Label htmlFor={`factory-number-${projectId}`}>
              Заводской номер домокомплекта
            </Label>
            <Input
              id={`factory-number-${projectId}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={pending}
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`contract-number-${projectId}`}>Номер договора</Label>
            <Input
              id={`contract-number-${projectId}`}
              value={contract}
              onChange={(event) => setContract(event.target.value)}
              disabled={pending}
            />
          </div>

          {(technology === "pkd" || technology === "md") && (
            <div className="grid gap-2">
              <Label htmlFor={`technology-${projectId}`}>Технология</Label>
              <select
                id={`technology-${projectId}`}
                value={tech}
                onChange={(event) =>
                  setTech(event.target.value as ProjectTechnologyValue | "")
                }
                className={selectClassName}
                style={{ backgroundImage: selectChevron }}
                disabled={pending}
              >
                <option value="" disabled>
                  Выберите технологию
                </option>
                {PROJECT_TECHNOLOGY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Отмена</AlertDialogCancel>
          <AlertDialogAction
            disabled={
              pending ||
              !name.trim() ||
              !contract.trim() ||
              ((technology === "pkd" || technology === "md") && !tech)
            }
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
