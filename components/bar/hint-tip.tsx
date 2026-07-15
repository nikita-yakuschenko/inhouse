"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { IconHelpCircle } from "@tabler/icons-react";

type Props = {
  children: React.ReactNode;
  label?: string;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
};

/** Иконка «?» с тултипом у подписей полей. */
export function HintTip({
  children,
  label = "Подробнее",
  side = "top",
  className,
}: Props) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        className={cn(
          "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
        aria-label={label}
      >
        <IconHelpCircle className="size-3.5" aria-hidden />
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs text-pretty">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
