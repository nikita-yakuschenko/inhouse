"use client";

import { useEffect, useMemo, useRef } from "react";

import type { ClientPart } from "@/features/projects/serialize-panels";
import { partitionPartsByWorkType } from "@/lib/parts/part-work-type";
import { cn } from "@/lib/utils";

const rowGrid =
  "grid w-full grid-cols-[minmax(0,1fr)_2.25rem_minmax(5.5rem,auto)] items-center gap-x-1 px-3 lg:px-4";

type PartsPanelProps = {
  parts: ClientPart[];
  activePartId?: string | null;
  onPartSelect?: (partId: string) => void;
  sheetWidthMm?: number | null;
  sheetHeightMm?: number | null;
};

function PartRows({
  parts,
  activePartId,
  onPartSelect,
  activeRowRef,
}: {
  parts: ClientPart[];
  activePartId?: string | null;
  onPartSelect?: (partId: string) => void;
  activeRowRef: React.RefObject<HTMLButtonElement | null>;
}) {
  return parts.map((part) => {
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
  });
}

export function PartsPanel({
  parts,
  activePartId,
  onPartSelect,
  sheetWidthMm,
  sheetHeightMm,
}: PartsPanelProps) {
  const activeRowRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activePartId]);

  const { cuttingAndMarking, markingOnly } = useMemo(
    () => partitionPartsByWorkType(parts, sheetWidthMm, sheetHeightMm),
    [parts, sheetWidthMm, sheetHeightMm],
  );

  const grouped = markingOnly.length > 0;

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
      ) : grouped ? (
        <>
          {cuttingAndMarking.length > 0 ? (
            <>
              <div className="border-b bg-muted/20 px-3 py-1.5 text-[11px] font-medium text-muted-foreground lg:px-4">
                Раскрой и маркировка
              </div>
              <PartRows
                parts={cuttingAndMarking}
                activePartId={activePartId}
                onPartSelect={onPartSelect}
                activeRowRef={activeRowRef}
              />
            </>
          ) : null}
          {markingOnly.length > 0 ? (
            <>
              <div className="border-b bg-muted/20 px-3 py-1.5 text-[11px] font-medium text-muted-foreground lg:px-4">
                Только маркировка
              </div>
              <PartRows
                parts={markingOnly}
                activePartId={activePartId}
                onPartSelect={onPartSelect}
                activeRowRef={activeRowRef}
              />
            </>
          ) : null}
        </>
      ) : (
        <PartRows
          parts={parts}
          activePartId={activePartId}
          onPartSelect={onPartSelect}
          activeRowRef={activeRowRef}
        />
      )}
    </div>
  );
}
