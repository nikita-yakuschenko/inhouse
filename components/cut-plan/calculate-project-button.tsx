"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { CutCalculateButton } from "@/components/cut-plan/cut-calculate-button";
import { calculateProjectAction } from "@/features/cut-plans/actions";
import { russianErrorMessage } from "@/lib/ui/notify";

export function CalculateProjectButton({
  projectId,
  disabled = false,
  disabledReason,
  className,
}: {
  projectId: string;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <CutCalculateButton
      pending={isPending}
      disabled={disabled}
      className={className}
      title={disabled ? disabledReason : undefined}
      onClick={() => {
        if (disabled) {
          toast.error(disabledReason ?? "Сначала выберите материал");
          return;
        }
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
    />
  );
}
