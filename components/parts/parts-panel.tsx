"use client";

import { useEffect, useRef } from "react";

import type { ClientPart } from "@/features/projects/serialize-panels";
import { cn } from "@/lib/utils";

const rowGrid =
  "grid w-full grid-cols-[minmax(0,1fr)_2.25rem_minmax(5.5rem,auto)] items-center gap-x-1 px-3 lg:px-4";

type PartsPanelProps = {
  parts: ClientPart[];
  activePartId?: string | null;
  onPartSelect?: (partId: string) => void;
};

export function PartsPanel({ parts, activePartId, onPartSelect }: PartsPanelProps) {
  const activeRowRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activePartId]);

  return (
    <div className="w-full text-xs">
      <div className={`${rowGrid} border-b bg-muted/30 py-1.5 font-medium`}>
        <div>Марка</div>
        <div className="text-center" title="Количество">
          Кол.
        </div>
        <div className="text-right">Размер</div>
      </div>

      {parts.length === 0 ? (
        <div className="px-3 py-6 text-center text-muted-foreground lg:px-4">
          Нет деталей на панели
        </div>
      ) : (
        parts.map((part) => {
          const isActive = activePartId != null && part.id === activePartId;

          return (
            <button
              key={part.id}
              type="button"
              ref={isActive ? activeRowRef : undefined}
              onClick={() => onPartSelect?.(part.id)}
              className={cn(
                rowGrid,
                "w-full border-b border-l-[3px] border-l-transparent py-2 text-left last:border-0 transition-colors",
                onPartSelect && "cursor-pointer hover:bg-muted/50",
                isActive
                  ? "border-l-emerald-500 bg-primary font-semibold text-primary-foreground shadow-sm hover:bg-primary"
                  : "text-foreground",
              )}
            >
              <div className="truncate font-medium" title={part.name}>
                {part.name}
              </div>
              <div className="text-center tabular-nums">{part.quantity}</div>
              <div
                className={cn(
                  "text-right tabular-nums whitespace-nowrap",
                  isActive ? "text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {part.widthMm}×{part.heightMm}
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}
