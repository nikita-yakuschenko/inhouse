"use client";

import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import {
  filterLeadersByGap,
  nextPieceStartLeaders,
  staggerLeaders,
} from "@/lib/bar/dimension-leaders";
import type { BarLayout, PlacedPiece } from "@/lib/engine-bar/cutting";

/** Кислотно красно-розовый — зона пропила и метки. */
const CUT_MARK_COLOR = "#ff2d78";

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "oklch(0.55 0.2 280)",
  "oklch(0.6 0.18 200)",
  "oklch(0.65 0.15 140)",
];

function aggregatePiecesForLegend(pieces: PlacedPiece[]) {
  const map = new Map<
    string,
    { label: string; lengthMm: number; colorIndex: number; count: number }
  >();
  for (const p of pieces) {
    const prev = map.get(p.demandId);
    if (!prev) {
      map.set(p.demandId, {
        label: p.label,
        lengthMm: p.lengthMm,
        colorIndex: p.colorIndex,
        count: 1,
      });
    } else {
      prev.count += 1;
    }
  }
  return [...map.values()].sort((a, b) => b.lengthMm - a.lengthMm);
}

function KerfSlot({ kerfMm }: { kerfMm: number }) {
  return (
    <div
      className="relative z-10 shrink-0 border-y border-[#ff2d78]/70 bg-[#ff2d78]/30"
      style={{ flex: `${kerfMm} 1 0%`, minWidth: 2 }}
      title={`Пропил ${kerfMm} мм`}
      aria-hidden
    />
  );
}

type Props = {
  bar: BarLayout;
  kerfMm: number;
  displayIndex: number;
  repeat?: number;
};

/** Проверка, поместится ли число длины внутрь сегмента (приближенно, без замеров DOM). */
function canShowPieceValue(lengthMm: number, stockLengthMm: number): boolean {
  if (stockLengthMm <= 0) return false;
  const digits = String(Math.round(lengthMm)).length;
  const minFrac = 0.016 + digits * 0.0025;
  return lengthMm / stockLengthMm >= minFrac;
}

/** Число + линия со стрелкой к началу следующей детали (правый край выноски = точка отсчёта). */
const LEADER_LANE_OFFSET_PX = 22;

function DimensionLeader({
  valueRounded,
  leftPct,
  lane,
}: {
  valueRounded: number;
  leftPct: number;
  lane: 0 | 1;
}) {
  return (
    <div
      className="pointer-events-none absolute flex flex-col items-end"
      style={{
        left: `${leftPct}%`,
        bottom: lane === 0 ? 0 : LEADER_LANE_OFFSET_PX,
        transform: "translateX(-100%)",
        width: "max-content",
        zIndex: lane === 1 ? 2 : 1,
      }}
    >
      <span
        className="mb-0.5 pr-0.5 text-[10px] leading-none font-medium tabular-nums"
        style={{ color: CUT_MARK_COLOR }}
      >
        {valueRounded}
      </span>
      <svg
        width="48"
        height="11"
        viewBox="0 0 48 11"
        style={{ color: CUT_MARK_COLOR }}
        aria-hidden
      >
        <line
          x1="0"
          y1="8"
          x2="36"
          y2="8"
          stroke="currentColor"
          strokeWidth="1.1"
        />
        <path d="M36 8 L44 5 L44 11 Z" fill="currentColor" />
      </svg>
    </div>
  );
}

export function CuttingBarDiagram({
  bar,
  kerfMm,
  displayIndex,
  repeat = 1,
}: Props) {
  const stockLengthMm = bar.stockLengthMm;
  const wasteMm = Math.max(0, bar.wasteMm);

  const rangeLabel =
    repeat > 1
      ? `№ ${displayIndex}–${displayIndex + repeat - 1}`
      : `№ ${displayIndex}`;

  const leadersRaw = nextPieceStartLeaders(bar, kerfMm);
  const leadersFiltered = filterLeadersByGap(
    leadersRaw,
    stockLengthMm,
    0.045
  );
  const leaders = staggerLeaders(leadersFiltered, stockLengthMm);
  const legendRows = aggregatePiecesForLegend(bar.pieces);

  return (
    <div className="border-border/60 bg-card/30 w-full rounded-md border px-3 py-2">
      <div className="mb-1.5 flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <p className="min-w-0 flex-1 text-[11px] leading-snug text-muted-foreground">
          <Badge variant="secondary" className="mr-1.5 inline h-5 align-middle px-1.5 font-mono text-[10px]">
            {repeat}×
          </Badge>
          <span className="text-foreground font-medium tabular-nums">{rangeLabel}</span>
          <span className="mx-1.5 text-muted-foreground">|</span>
          <span>
            Длина заготовки -{" "}
            <span className="tabular-nums text-foreground">{stockLengthMm}</span> мм | Детали -{" "}
            {legendRows.length === 0 ? (
              <span className="text-foreground">—</span>
            ) : (
              <span className="inline align-middle">
                {legendRows.map((row, i) => {
                  const name = row.label.trim() || `${row.lengthMm} мм`;
                  return (
                    <Fragment key={`${displayIndex}-det-${row.label}-${row.lengthMm}-${i}`}>
                      {i > 0 ? (
                        <span className="text-muted-foreground">, </span>
                      ) : null}
                      <span
                        className="inline-flex items-center gap-1 align-middle"
                        title={`${row.label}: ${row.lengthMm} мм — ${row.count} шт.`}
                      >
                        <span
                          className="inline-block size-1.5 shrink-0 rounded-sm"
                          style={{
                            background: PALETTE[row.colorIndex % PALETTE.length],
                          }}
                        />
                        <span className="tabular-nums text-foreground">
                          {name} × {row.count}
                        </span>
                      </span>
                    </Fragment>
                  );
                })}
              </span>
            )}
          </span>
        </p>
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          ост. {bar.wasteMm.toFixed(0)} мм · занято {bar.usedMm.toFixed(0)} мм
        </span>
      </div>

      <div className="font-[family-name:var(--font-ibm-plex)]">
        <div className="my-1.5 flex h-9 w-full min-w-0 items-stretch overflow-visible rounded-sm border border-border bg-muted/35 p-px shadow-sm">
          {bar.pieces.map((p, i) => {
          const isFirst = i === 0;
          const isLastPiece = i === bar.pieces.length - 1;
          const showValue = canShowPieceValue(p.lengthMm, stockLengthMm);
          const roundL = isFirst ? "rounded-l-[3px]" : "";
          const roundR =
            isLastPiece && wasteMm <= 0 ? "rounded-r-[3px]" : "";

            return (
              <Fragment key={`${displayIndex}-seg-${i}`}>
              <div
                className={`border-border/80 flex min-h-0 min-w-0 flex-col overflow-hidden border bg-background/40 ${roundL} ${roundR}`}
                style={{ flex: `${p.lengthMm} 1 0%`, minWidth: 2 }}
                title={`${p.label}: ${p.lengthMm} мм`}
              >
                <div
                  className="flex min-h-[32px] flex-1 items-center justify-center px-px text-center"
                  style={{ background: PALETTE[p.colorIndex % PALETTE.length] }}
                >
                  {showValue && (
                    <span className="text-[10px] leading-tight font-medium text-white tabular-nums [text-shadow:0_0_2px_rgba(0,0,0,0.65)]">
                      {p.lengthMm}
                    </span>
                  )}
                </div>
              </div>
              {i < bar.pieces.length - 1 && <KerfSlot kerfMm={kerfMm} />}
              </Fragment>
            );
          })}
          {wasteMm > 0 && bar.pieces.length > 0 && <KerfSlot kerfMm={kerfMm} />}
          {wasteMm > 0 && (
            <div
              className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-r-[3px] border border-dashed border-muted-foreground/30 bg-background/30"
              style={{
                flex: `${wasteMm} 1 0%`,
                minWidth: 2,
                backgroundImage: `repeating-linear-gradient(
                -45deg,
                transparent,
                transparent 4px,
                color-mix(in oklab, var(--foreground) 20%, transparent) 4px,
                color-mix(in oklab, var(--foreground) 20%, transparent) 5px
              )`,
              }}
              title={`Остаток: ${wasteMm.toFixed(0)} мм`}
            />
          )}
        </div>

        {/* Выноски: число, красная линия, стрелка; близкие — на разной высоте */}
        <div
          className="relative mt-0 w-full"
          style={{ minHeight: 42 + LEADER_LANE_OFFSET_PX }}
        >
          {leaders.map((L, idx) => (
            <DimensionLeader
              key={`${displayIndex}-ld-${idx}-${L.anchorMm}`}
              valueRounded={Math.round(L.valueMm)}
              leftPct={(L.anchorMm / stockLengthMm) * 100}
              lane={L.lane}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
