"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { calculateProjectAction } from "@/features/cut-plans/actions";
import { Button } from "@/components/ui/button";

export function CalculateProjectButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          try {
            await calculateProjectAction(projectId);
            router.refresh();
          } catch (error) {
            alert(error instanceof Error ? error.message : "Ошибка расчёта");
          }
        });
      }}
    >
      {isPending ? "Расчёт..." : "Раскроить проект"}
    </Button>
  );
}
