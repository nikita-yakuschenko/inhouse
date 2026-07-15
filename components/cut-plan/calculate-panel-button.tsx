"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { calculatePanelAction } from "@/features/cut-plans/actions";
import { Button } from "@/components/ui/button";
import { russianErrorMessage } from "@/lib/ui/notify";

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
            toast.success("Раскрой панели рассчитан");
            router.refresh();
          } catch (error) {
            toast.error(
              russianErrorMessage(error, "Не удалось рассчитать раскрой"),
            );
          }
        });
      }}
    >
      {isPending ? "Расчёт..." : "Раскроить панель"}
    </Button>
  );
}
