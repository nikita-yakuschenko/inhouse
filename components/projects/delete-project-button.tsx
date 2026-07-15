"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconTrash } from "@tabler/icons-react";
import { toast } from "sonner";

import { deleteProjectAction } from "@/features/projects/actions";
import { confirmToast } from "@/lib/ui/notify";

type DeleteProjectButtonProps = {
  projectId: string;
  projectName: string;
};

export function DeleteProjectButton({ projectId, projectName }: DeleteProjectButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick(event: React.MouseEvent | React.KeyboardEvent) {
    event.stopPropagation();
    if (pending) return;

    confirmToast({
      title: "Удалить расчёт?",
      description: `«${projectName}» будет удалён вместе с картами раскроя.`,
      confirmLabel: "Удалить",
      cancelLabel: "Отмена",
      onConfirm: () =>
        new Promise<void>((resolve) => {
          startTransition(async () => {
            try {
              const result = await deleteProjectAction(projectId);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              toast.success("Расчёт удалён", { description: projectName });
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
      aria-label={`Удалить «${projectName}»`}
      title="Удалить"
      disabled={pending}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleClick(event);
        }
        event.stopPropagation();
      }}
    >
      <IconTrash className="size-4" stroke={1.75} />
    </button>
  );
}
