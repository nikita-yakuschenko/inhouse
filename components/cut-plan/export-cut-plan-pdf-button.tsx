"use client";

import { useTransition } from "react";
import { IconDownload } from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  collectCutPlanPdfPages,
  type CutPlanPdfMeta,
} from "@/lib/cut-plan/cut-plan-pdf-shared";
import type { ClientPanel } from "@/features/projects/serialize-panels";
import { russianErrorMessage } from "@/lib/ui/notify";

export function ExportCutPlanPdfButton({
  meta,
  panels,
}: {
  meta: CutPlanPdfMeta;
  panels: ClientPanel[];
}) {
  const [isPending, startTransition] = useTransition();
  const pages = collectCutPlanPdfPages(panels, meta);
  const disabled = pages.length === 0;

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
            await exportCutPlanPdf(meta, pages);
            toast.success("PDF сохранён");
          } catch (error) {
            toast.error(
              russianErrorMessage(error, "Не удалось сформировать PDF"),
            );
          }
        });
      }}
    >
      <IconDownload className="size-4" />
      {isPending ? "PDF..." : "Скачать PDF"}
    </Button>
  );
}
