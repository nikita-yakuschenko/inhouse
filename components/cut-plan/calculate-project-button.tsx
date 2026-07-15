"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { calculateProjectAction } from "@/features/cut-plans/actions";
import { Button } from "@/components/ui/button";
import { russianErrorMessage } from "@/lib/ui/notify";

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
            toast.success("Раскрой рассчитан");
            router.refresh();
          } catch (error) {
            toast.error(
              russianErrorMessage(error, "Не удалось рассчитать раскрой"),
            );
          }
        });
      }}
    >
      {isPending ? "Расчёт..." : "Раскроить проект"}
    </Button>
  );
}
