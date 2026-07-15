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
import type {
  CatalogMachineOption,
  CatalogSheetFormatOption,
} from "@/components/projects/create-project-form";
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
  kind?: "sheet" | "bar";
  sheetFormatId?: string | null;
  machineProfileId?: string | null;
  hasCutPlan?: boolean;
  sheetFormats?: CatalogSheetFormatOption[];
  machineProfiles?: CatalogMachineOption[];
};

export function EditProjectButton({
  projectId,
  factoryNumber,
  contractNumber,
  technology,
  kind = "sheet",
  sheetFormatId = null,
  machineProfileId = null,
  hasCutPlan = false,
  sheetFormats = [],
  machineProfiles = [],
}: EditProjectButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [name, setName] = useState(factoryNumber);
  const [contract, setContract] = useState(contractNumber ?? "");
  const [tech, setTech] = useState<ProjectTechnologyValue | "">(technology ?? "");
  const [sheetId, setSheetId] = useState(sheetFormatId ?? "");
  const [machineId, setMachineId] = useState(machineProfileId ?? "");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setName(factoryNumber);
    setContract(contractNumber ?? "");
    setTech(technology ?? "");
    setSheetId(sheetFormatId ?? "");
    setMachineId(machineProfileId ?? "");
  }, [
    open,
    factoryNumber,
    contractNumber,
    technology,
    sheetFormatId,
    machineProfileId,
  ]);

  const isSheet = kind === "sheet";
  const needsTechnology = technology === "pkd" || technology === "md";

  function setupChanged() {
    const materialChanged = (sheetId || null) !== (sheetFormatId || null);
    const machineChanged = (machineId || null) !== (machineProfileId || null);
    return materialChanged || machineChanged;
  }

  function persist() {
    startTransition(async () => {
      const result = await updateProjectAction({
        projectId,
        name: name.trim(),
        contractNumber: contract.trim(),
        technology: needsTechnology ? tech : null,
        ...(isSheet
          ? {
              sheetFormatId: sheetId || null,
              machineProfileId: machineId || null,
            }
          : {}),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setConfirmOpen(false);
      setOpen(false);
      if (result.recalculated) {
        toast.success("Раскрой пересчитан", {
          description: "Параметры сохранены, карта раскроя обновлена.",
        });
      } else {
        toast.success("Расчёт обновлён", {
          description: result.name,
        });
      }
      router.refresh();
    });
  }

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
    if (needsTechnology && tech !== "pkd" && tech !== "md") {
      toast.error("Выберите технологию");
      return;
    }

    const unchanged =
      nextName === factoryNumber &&
      nextContract === (contractNumber ?? "") &&
      tech === (technology ?? "") &&
      !setupChanged();

    if (unchanged) {
      setOpen(false);
      return;
    }

    if (isSheet && hasCutPlan && setupChanged()) {
      setConfirmOpen(true);
      return;
    }

    persist();
  }

  return (
    <>
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
              {isSheet
                ? "Можно изменить реквизиты, материал и станок. При смене материала или станка сохранённый раскрой будет пересчитан."
                : "Измените реквизиты расчёта."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-3 py-1">
            <div className="grid gap-2">
              <Label htmlFor={`factory-number-${projectId}`}>
                {isSheet ? "Заводской номер домокомплекта" : "Название"}
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

            {needsTechnology && (
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

            {isSheet && sheetFormats.length > 0 ? (
              <div className="grid gap-2">
                <Label htmlFor={`material-${projectId}`}>Материал</Label>
                <select
                  id={`material-${projectId}`}
                  value={sheetId}
                  onChange={(event) => setSheetId(event.target.value)}
                  className={selectClassName}
                  style={{ backgroundImage: selectChevron }}
                  disabled={pending}
                >
                  <option value="">Не выбран</option>
                  {sheetFormats.map((sheet) => (
                    <option key={sheet.id} value={sheet.id}>
                      {sheet.material.name} · {sheet.widthMm}×{sheet.heightMm}×
                      {Number(sheet.thicknessMm)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {isSheet && machineProfiles.length > 0 ? (
              <div className="grid gap-2">
                <Label htmlFor={`machine-${projectId}`}>Станок</Label>
                <select
                  id={`machine-${projectId}`}
                  value={machineId}
                  onChange={(event) => setMachineId(event.target.value)}
                  className={selectClassName}
                  style={{ backgroundImage: selectChevron }}
                  disabled={pending}
                >
                  <option value="">Не выбран</option>
                  {machineProfiles.map((machine) => (
                    <option key={machine.id} value={machine.id}>
                      {machine.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={
                pending ||
                !name.trim() ||
                !contract.trim() ||
                (needsTechnology && !tech)
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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Пересчитать раскрой?</AlertDialogTitle>
            <AlertDialogDescription>
              Материал или станок изменились. Сохранённый раскрой будет
              автоматически пересчитан. Продолжить?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                persist();
              }}
            >
              {pending ? "Пересчёт…" : "Сохранить и пересчитать"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
