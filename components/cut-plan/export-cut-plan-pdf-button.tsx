"use client";

import { useTransition } from "react";
import { IconDownload } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  collectCutPlanPdfSheets,
  type CutPlanPdfMeta,
} from "@/lib/cut-plan/cut-plan-pdf-shared";
import type { ClientPanel } from "@/features/projects/serialize-panels";

export function ExportCutPlanPdfButton({
  meta,
  panels,
}: {
  meta: CutPlanPdfMeta;
  panels: ClientPanel[];
}) {
  const [isPending, startTransition] = useTransition();
  const sheets = collectCutPlanPdfSheets(panels);
  const disabled = sheets.length === 0;

  return (
    <Button
      type="button"
      variant="outline"
      className="gap-2"
      disabled={disabled || isPending}
      onClick={() => {
        startTransition(async () => {
          try {
            const { exportCutPlanPdf } = await import("@/lib/cut-plan/export-cut-plan-pdf");
            await exportCutPlanPdf(meta, sheets);
          } catch (error) {
            alert(error instanceof Error ? error.message : "Не удалось сформировать PDF");
          }
        });
      }}
    >
      <IconDownload className="size-4" />
      {isPending ? "PDF..." : "Скачать PDF"}
    </Button>
  );
}
