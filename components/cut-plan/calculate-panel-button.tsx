"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { calculatePanelAction } from "@/features/cut-plans/actions";
import { Button } from "@/components/ui/button";

export function CalculatePanelButton({
  projectId,
  panelId,
}: {
  projectId: string;
  panelId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          try {
            await calculatePanelAction(projectId, panelId);
            router.refresh();
          } catch (error) {
            alert(error instanceof Error ? error.message : "Ошибка расчёта");
          }
        });
      }}
    >
      {isPending ? "Расчёт..." : "Раскроить панель"}
    </Button>
  );
}
