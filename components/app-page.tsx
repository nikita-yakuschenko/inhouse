import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AppPage({
  header,
  children,
  fill = false,
}: {
  header: ReactNode;
  children: ReactNode;
  /** Рабочая область на весь экран без внешней прокрутки */
  fill?: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {header}
      <div
        className={cn("min-h-0 flex-1", fill ? "overflow-hidden" : "overflow-y-auto")}
      >
        {children}
      </div>
    </div>
  );
}
