"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import type {
  CatalogMachineOption,
  CatalogSheetFormatOption,
} from "@/components/projects/create-project-form";
import { updateProjectCuttingSetupAction } from "@/features/projects/actions";
import { cn } from "@/lib/utils";

const selectClassName = cn(
  "flex h-9 w-full min-w-[12rem] appearance-none rounded-md border border-input bg-transparent px-3 py-1 pr-9 text-sm shadow-xs outline-none",
  "bg-[length:12px_12px] bg-[position:right_12px_center] bg-no-repeat",
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

const selectChevron =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

type Props = {
  projectId: string;
  sheetFormatId: string | null;
  machineProfileId: string | null;
  hasCutPlan: boolean;
  sheetFormats: CatalogSheetFormatOption[];
  machineProfiles: CatalogMachineOption[];
};

export function ProjectCuttingSetupSelects({
  projectId,
  sheetFormatId,
  machineProfileId,
  hasCutPlan,
  sheetFormats,
  machineProfiles,
}: Props) {
  const router = useRouter();
  const [sheetId, setSheetId] = useState(sheetFormatId ?? "");
  const [machineId, setMachineId] = useState(machineProfileId ?? "");
  const [pendingChange, setPendingChange] = useState<{
    sheetFormatId?: string | null;
    machineProfileId?: string | null;
    label: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setSheetId(sheetFormatId ?? "");
  }, [sheetFormatId]);

  useEffect(() => {
    setMachineId(machineProfileId ?? "");
  }, [machineProfileId]);

  function applyChange(change: {
    sheetFormatId?: string | null;
    machineProfileId?: string | null;
  }) {
    startTransition(async () => {
      const result = await updateProjectCuttingSetupAction({
        projectId,
        ...change,
      });
      if (!result.ok) {
        toast.error(result.error);
        setSheetId(sheetFormatId ?? "");
        setMachineId(machineProfileId ?? "");
        setPendingChange(null);
        return;
      }

      setPendingChange(null);
      if (result.recalculated) {
        toast.success("Раскрой пересчитан", {
          description: "Карта раскроя обновлена под новые параметры.",
        });
      } else {
        toast.success("Сохранено");
      }
      router.refresh();
    });
  }

  function requestChange(
    next: {
      sheetFormatId?: string | null;
      machineProfileId?: string | null;
    },
    label: string,
  ) {
    const materialChanging =
      next.sheetFormatId !== undefined &&
      (next.sheetFormatId || null) !== (sheetFormatId || null);
    const machineChanging =
      next.machineProfileId !== undefined &&
      (next.machineProfileId || null) !== (machineProfileId || null);

    if (!materialChanging && !machineChanging) return;

    if (hasCutPlan && (materialChanging || machineChanging)) {
      setPendingChange({ ...next, label });
      return;
    }

    applyChange(next);
  }

  return (
    <>
      <div className="flex flex-wrap items-end gap-2">
        {sheetFormats.length > 0 ? (
          <div className="grid gap-1">
            <Label htmlFor={`ws-material-${projectId}`} className="text-xs">
              Материал
            </Label>
            <select
              id={`ws-material-${projectId}`}
              value={sheetId}
              disabled={pending}
              className={selectClassName}
              style={{ backgroundImage: selectChevron }}
              onChange={(event) => {
                const value = event.target.value;
                setSheetId(value);
                requestChange(
                  { sheetFormatId: value || null },
                  "материал",
                );
              }}
            >
              <option value="">Выберите материал</option>
              {sheetFormats.map((sheet) => (
                <option key={sheet.id} value={sheet.id}>
                  {sheet.material.name} · {sheet.widthMm}×{sheet.heightMm}×
                  {Number(sheet.thicknessMm)}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {machineProfiles.length > 0 ? (
          <div className="grid gap-1">
            <Label htmlFor={`ws-machine-${projectId}`} className="text-xs">
              Станок
            </Label>
            <select
              id={`ws-machine-${projectId}`}
              value={machineId}
              disabled={pending}
              className={selectClassName}
              style={{ backgroundImage: selectChevron }}
              onChange={(event) => {
                const value = event.target.value;
                setMachineId(value);
                requestChange(
                  { machineProfileId: value || null },
                  "станок",
                );
              }}
            >
              <option value="">Выберите станок</option>
              {machineProfiles.map((machine) => (
                <option key={machine.id} value={machine.id}>
                  {machine.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <AlertDialog
        open={pendingChange != null}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setPendingChange(null);
            setSheetId(sheetFormatId ?? "");
            setMachineId(machineProfileId ?? "");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Пересчитать раскрой?</AlertDialogTitle>
            <AlertDialogDescription>
              Меняется {pendingChange?.label}. Сохранённый раскрой будет
              автоматически пересчитан. Продолжить?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending || !pendingChange}
              onClick={(event) => {
                event.preventDefault();
                if (!pendingChange) return;
                const { label: _label, ...change } = pendingChange;
                applyChange(change);
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
