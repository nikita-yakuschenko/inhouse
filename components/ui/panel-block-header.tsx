import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PanelBlockHeaderProps = {
  children: ReactNode;
  className?: string;
};

export function PanelBlockHeader({ children, className }: PanelBlockHeaderProps) {
  return (
    <div
      className={cn(
        "flex h-12 shrink-0 items-center border-b bg-muted/40 px-3 lg:px-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
