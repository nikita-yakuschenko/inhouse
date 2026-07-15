import type { LabelBadge, PartLabelText } from "@/lib/cut-plan/part-label-layout";
import type { MmRect } from "@/lib/cut-plan/operator-view";

/** Локальный поворот как в SVG `rotate(deg)` (y вниз). */
export function rotateLocalPoint(xMm: number, yMm: number, rotateDeg: number) {
  const radians = (rotateDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    xMm: xMm * cos + yMm * sin,
    yMm: -xMm * sin + yMm * cos,
  };
}

export function mapRotatedBadgeCorners(
  anchor: Pick<PartLabelText, "xMm" | "yMm">,
  badge: LabelBadge,
  rotateDeg: number,
) {
  const corners = [
    { xMm: badge.xMm, yMm: badge.yMm },
    { xMm: badge.xMm + badge.widthMm, yMm: badge.yMm },
    { xMm: badge.xMm + badge.widthMm, yMm: badge.yMm + badge.heightMm },
    { xMm: badge.xMm, yMm: badge.yMm + badge.heightMm },
  ];

  return corners.map((corner) => {
    const rotated = rotateLocalPoint(corner.xMm, corner.yMm, rotateDeg);
    return {
      xMm: anchor.xMm + rotated.xMm,
      yMm: anchor.yMm + rotated.yMm,
    };
  });
}

export function mapRotatedBadgeBounds(
  anchor: Pick<PartLabelText, "xMm" | "yMm">,
  badge: LabelBadge,
  rotateDeg: number,
): MmRect {
  const corners = mapRotatedBadgeCorners(anchor, badge, rotateDeg);
  const xs = corners.map((corner) => corner.xMm);
  const ys = corners.map((corner) => corner.yMm);

  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    xMm: minX,
    yMm: minY,
    widthMm: maxX - minX,
    heightMm: maxY - minY,
  };
}

/**
 * Левый baseline в SVG (y вниз) так, чтобы после translate+rotate
 * визуальный центр текста был в якоре (middle / middle).
 */
export function rotatedTextBaselineSvg(
  anchor: Pick<PartLabelText, "xMm" | "yMm" | "rotateDeg">,
  textWidthMm: number,
  fontSizeMm: number,
) {
  const rotateDeg = anchor.rotateDeg ?? 0;
  // Как drawLabelText для middle: baseline ниже центра ~0.35 em.
  const local = rotateLocalPoint(-textWidthMm / 2, fontSizeMm * 0.35, rotateDeg);
  return {
    xMm: anchor.xMm + local.xMm,
    yMm: anchor.yMm + local.yMm,
    rotateDeg,
  };
}
