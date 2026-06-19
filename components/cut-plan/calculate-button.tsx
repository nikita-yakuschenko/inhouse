"use client";

import { useTransition } from "react";
import { calculateProjectAction } from "@/features/cut-plans/actions";
import { Button } from "@/components/ui/button";

export function CalculateButton({ projectId }: { projectId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          try {
            await calculateProjectAction(projectId);
          } catch (error) {
            alert(error instanceof Error ? error.message : "Ошибка расчёта");
          }
        });
      }}
    >
      {isPending ? "Расчёт..." : "Раскроить"}
    </Button>
  );
}
