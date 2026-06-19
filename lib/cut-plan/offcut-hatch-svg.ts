import type { MmRect } from "@/lib/cut-plan/operator-view";
import { buildOffcutHatchLines } from "@/lib/cut-plan/offcut-hatch";

const HATCH_STROKE = "#94a3b8";
const HATCH_FILL = "#f1f5f9";

export function buildOffcutHatchSvg(rect: MmRect, clipId: string) {
  const lines = buildOffcutHatchLines(rect)
    .map(
      (line) =>
        `<line x1="${line.x1Mm}" y1="${line.y1Mm}" x2="${line.x2Mm}" y2="${line.y2Mm}" stroke="${HATCH_STROKE}" stroke-width="1.2" />`,
    )
    .join("");

  return `<clipPath id="${clipId}">
      <rect x="${rect.xMm}" y="${rect.yMm}" width="${rect.widthMm}" height="${rect.heightMm}" />
    </clipPath>
    <g clip-path="url(#${clipId})">
      <rect x="${rect.xMm}" y="${rect.yMm}" width="${rect.widthMm}" height="${rect.heightMm}" fill="${HATCH_FILL}" />
      ${lines}
    </g>`;
}
