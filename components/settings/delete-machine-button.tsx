"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconTrash } from "@tabler/icons-react";
import { toast } from "sonner";

import { deleteMachineProfileAction } from "@/features/machines/actions";
import { confirmToast } from "@/lib/ui/notify";

export function DeleteMachineButton({
  machineId,
  machineName,
}: {
  machineId: string;
  machineName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (pending) return;

    confirmToast({
      title: "Удалить оборудование?",
      description: `«${machineName}» будет удалён из списка.`,
      confirmLabel: "Удалить",
      cancelLabel: "Отмена",
      onConfirm: () =>
        new Promise<void>((resolve) => {
          startTransition(async () => {
            try {
              const result = await deleteMachineProfileAction(machineId);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              toast.success("Оборудование удалено", { description: machineName });
              router.refresh();
            } finally {
              resolve();
            }
          });
        }),
    });
  }

  return (
    <button
      type="button"
      className="inline-flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
      aria-label={`Удалить «${machineName}»`}
      title="Удалить"
      disabled={pending}
      onClick={handleClick}
    >
      <IconTrash className="size-4" stroke={1.75} />
    </button>
  );
}
