"use client";

import type { ComponentProps } from "react";
import { IconLoader2, IconScissors } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonProps = ComponentProps<typeof Button>;

/**
 * Единая кнопка расчёта раскроя (плиты и погонаж).
 * Ширина не прыгает: idle и loading наложены в grid.
 */
export function CutCalculateButton({
  pending,
  className,
  childrenIdle = "Рассчитать раскрой",
  childrenPending = "Считаем…",
  ...props
}: Omit<ButtonProps, "children"> & {
  pending: boolean;
  childrenIdle?: string;
  childrenPending?: string;
}) {
  return (
    <Button
      type="button"
      disabled={pending || props.disabled}
      className={cn(
        "relative min-w-[11.5rem] overflow-hidden transition-[opacity,box-shadow,transform] duration-200",
        pending && "shadow-none",
        className,
      )}
      aria-busy={pending}
      {...props}
    >
      <span className="inline-grid place-items-center">
        <span
          className={cn(
            "col-start-1 row-start-1 inline-flex items-center gap-2 transition-opacity duration-200",
            pending ? "pointer-events-none opacity-0" : "opacity-100",
          )}
          aria-hidden={pending}
        >
          <IconScissors className="size-4" stroke={1.75} />
          {childrenIdle}
        </span>
        <span
          className={cn(
            "col-start-1 row-start-1 inline-flex items-center gap-2 transition-opacity duration-200",
            pending ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          aria-hidden={!pending}
        >
          <IconLoader2
            className="size-4 animate-spin [animation-duration:0.85s]"
            stroke={1.75}
          />
          <span className="animate-pulse">{childrenPending}</span>
        </span>
      </span>
    </Button>
  );
}
