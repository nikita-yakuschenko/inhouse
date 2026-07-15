export type MmRect = {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
};

export type PartLabelText = {
  xMm: number;
  yMm: number;
  fontSizeMm: number;
  text: string;
  textAnchor?: "start" | "middle" | "end";
  dominantBaseline?: "hanging" | "middle" | "auto";
  rotateDeg?: number;
};

export type LabelBadge = {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
};

export type PartLabelLayout = {
  mode: "full" | "compact";
  marking: PartLabelText;
  centerSize: PartLabelText | null;
  bottomSide: PartLabelText | null;
  rightSide: PartLabelText | null;
  centerBadge: LabelBadge;
  bottomBadge: LabelBadge | null;
  rightBadge: LabelBadge | null;
};

/** Единые размеры подписей на карте (мм viewBox). */
export const LABEL_MARKING_FONT_MM = 40;
export const LABEL_CENTER_SIZE_FONT_MM = 32;
export const LABEL_SIDE_FONT_MM = 28;
export const LABEL_INSET_MM = 16;

/** Центральный бейдж: две строки. */
export const CENTER_BADGE_PAD_X_MM = 22;
export const CENTER_BADGE_PAD_Y_MM = 18;
export const CENTER_BADGE_LINE_GAP_MM = 14;

/** Боковой бейдж: одна строка, равномерные поля. */
export const SIDE_BADGE_PAD_MM = 16;

export const LABEL_BADGE_RADIUS_MM = 12;
export const LABEL_BADGE_STROKE_MM = 1.5;
export const LABEL_BADGE_FILL = "#ffffff";

const MIN_SIDE_LABEL_SHORT_SIDE_MM = 180;

function canShowSideLabels(rect: MmRect) {
  return Math.min(rect.widthMm, rect.heightMm) >= MIN_SIDE_LABEL_SHORT_SIDE_MM;
}

function estimateTextWidthMm(text: string, fontSizeMm: number) {
  return text.length * fontSizeMm * 0.58;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampBadgeToRect(badge: LabelBadge, rect: MmRect): LabelBadge {
  const inset = LABEL_INSET_MM + LABEL_BADGE_STROKE_MM;
  const minX = rect.xMm + inset;
  const minY = rect.yMm + inset;
  const maxX = rect.xMm + rect.widthMm - inset - badge.widthMm;
  const maxY = rect.yMm + rect.heightMm - inset - badge.heightMm;

  return {
    ...badge,
    xMm: clamp(badge.xMm, minX, Math.max(minX, maxX)),
    yMm: clamp(badge.yMm, minY, Math.max(minY, maxY)),
  };
}

function buildCenterBlock(
  centerX: number,
  centerY: number,
  marking: string,
  sizeText: string,
): {
  badge: LabelBadge;
  marking: PartLabelText;
  centerSize: PartLabelText;
} {
  const widthMm =
    Math.max(
      estimateTextWidthMm(marking, LABEL_MARKING_FONT_MM),
      estimateTextWidthMm(sizeText, LABEL_CENTER_SIZE_FONT_MM),
    ) +
    CENTER_BADGE_PAD_X_MM * 2;
  const heightMm =
    CENTER_BADGE_PAD_Y_MM * 2 +
    LABEL_MARKING_FONT_MM +
    CENTER_BADGE_LINE_GAP_MM +
    LABEL_CENTER_SIZE_FONT_MM;

  const badge: LabelBadge = {
    xMm: centerX - widthMm / 2,
    yMm: centerY - heightMm / 2,
    widthMm,
    heightMm,
  };

  const markingY = badge.yMm + CENTER_BADGE_PAD_Y_MM + LABEL_MARKING_FONT_MM / 2;
  const centerSizeY =
    markingY +
    LABEL_MARKING_FONT_MM / 2 +
    CENTER_BADGE_LINE_GAP_MM +
    LABEL_CENTER_SIZE_FONT_MM / 2;

  return {
    badge,
    marking: {
      xMm: centerX,
      yMm: markingY,
      fontSizeMm: LABEL_MARKING_FONT_MM,
      text: marking,
      textAnchor: "middle",
      dominantBaseline: "middle",
    },
    centerSize: {
      xMm: centerX,
      yMm: centerSizeY,
      fontSizeMm: LABEL_CENTER_SIZE_FONT_MM,
      text: sizeText,
      textAnchor: "middle",
      dominantBaseline: "middle",
    },
  };
}

function buildSingleLineBadge(text: string, fontSizeMm: number): LabelBadge {
  const widthMm = estimateTextWidthMm(text, fontSizeMm) + SIDE_BADGE_PAD_MM * 2;
  const heightMm = fontSizeMm + SIDE_BADGE_PAD_MM * 2;

  return {
    xMm: -widthMm / 2,
    yMm: -heightMm / 2,
    widthMm,
    heightMm,
  };
}

function buildFlatSingleLineBadge(
  text: string,
  fontSizeMm: number,
  centerX: number,
  centerY: number,
): LabelBadge {
  const badge = buildSingleLineBadge(text, fontSizeMm);

  return {
    xMm: centerX - badge.widthMm / 2,
    yMm: centerY - badge.heightMm / 2,
    widthMm: badge.widthMm,
    heightMm: badge.heightMm,
  };
}

function buildMarkingOnlyBlock(
  centerX: number,
  centerY: number,
  marking: string,
): {
  badge: LabelBadge;
  marking: PartLabelText;
} {
  const widthMm =
    estimateTextWidthMm(marking, LABEL_MARKING_FONT_MM) + CENTER_BADGE_PAD_X_MM * 2;
  const heightMm = LABEL_MARKING_FONT_MM + CENTER_BADGE_PAD_Y_MM * 2;

  const badge: LabelBadge = {
    xMm: centerX - widthMm / 2,
    yMm: centerY - heightMm / 2,
    widthMm,
    heightMm,
  };

  return {
    badge,
    marking: {
      xMm: centerX,
      yMm: centerY,
      fontSizeMm: LABEL_MARKING_FONT_MM,
      text: marking,
      textAnchor: "middle",
      dominantBaseline: "middle",
    },
  };
}

function badgesOverlap(a: LabelBadge, b: LabelBadge, gapMm = 12): boolean {
  return !(
    a.xMm + a.widthMm + gapMm <= b.xMm ||
    b.xMm + b.widthMm + gapMm <= a.xMm ||
    a.yMm + a.heightMm + gapMm <= b.yMm ||
    b.yMm + b.heightMm + gapMm <= a.yMm
  );
}

/** AABB повёрнутого правого бейджа (rotate -90 вокруг якоря). */
function rightBadgeAabb(anchorX: number, anchorY: number, local: LabelBadge): LabelBadge {
  return {
    xMm: anchorX - local.heightMm / 2,
    yMm: anchorY - local.widthMm / 2,
    widthMm: local.heightMm,
    heightMm: local.widthMm,
  };
}

function buildFittedCenterBlock(
  rect: MmRect,
  marking: string,
  sizeText: string,
): {
  badge: LabelBadge;
  marking: PartLabelText;
  centerSize: PartLabelText;
} {
  const centerX = rect.xMm + rect.widthMm / 2;
  const centerY = rect.yMm + rect.heightMm / 2;
  const inset = Math.min(
    LABEL_INSET_MM + LABEL_BADGE_STROKE_MM,
    Math.max(4, Math.min(rect.widthMm, rect.heightMm) * 0.06),
  );
  const availW = Math.max(24, rect.widthMm - inset * 2);
  const availH = Math.max(24, rect.heightMm - inset * 2);

  let fontMark = LABEL_MARKING_FONT_MM;
  let fontSize = LABEL_CENTER_SIZE_FONT_MM;
  let padX = CENTER_BADGE_PAD_X_MM;
  let padY = CENTER_BADGE_PAD_Y_MM;
  let lineGap = CENTER_BADGE_LINE_GAP_MM;

  for (let step = 0; step < 10; step += 1) {
    const widthMm =
      Math.max(
        estimateTextWidthMm(marking, fontMark),
        estimateTextWidthMm(sizeText, fontSize),
      ) +
      padX * 2;
    const heightMm = padY * 2 + fontMark + lineGap + fontSize;
    if (widthMm <= availW && heightMm <= availH) {
      const badge: LabelBadge = {
        xMm: centerX - widthMm / 2,
        yMm: centerY - heightMm / 2,
        widthMm,
        heightMm,
      };
      const markingY = badge.yMm + padY + fontMark / 2;
      const sizeY = markingY + fontMark / 2 + lineGap + fontSize / 2;
      return {
        badge,
        marking: {
          xMm: centerX,
          yMm: markingY,
          fontSizeMm: fontMark,
          text: marking,
          textAnchor: "middle",
          dominantBaseline: "middle",
        },
        centerSize: {
          xMm: centerX,
          yMm: sizeY,
          fontSizeMm: fontSize,
          text: sizeText,
          textAnchor: "middle",
          dominantBaseline: "middle",
        },
      };
    }

    const scale = Math.min(availW / widthMm, availH / heightMm) * 0.98;
    fontMark *= scale;
    fontSize *= scale;
    padX *= scale;
    padY *= scale;
    lineGap *= scale;
  }

  // Крайний случай: всё равно центрируем то, что получилось
  return buildCenterBlock(centerX, centerY, marking, sizeText);
}

export function buildPartLabelLayout(
  rect: MmRect,
  marking: string,
  partWidthMm: number,
  partHeightMm: number,
): PartLabelLayout {
  const centerX = rect.xMm + rect.widthMm / 2;
  const centerY = rect.yMm + rect.heightMm / 2;
  const sizeText = `${partWidthMm}×${partHeightMm}`;

  const compactLayout = (): PartLabelLayout => {
    const fitted = buildFittedCenterBlock(rect, marking, sizeText);
    return {
      mode: "compact",
      marking: fitted.marking,
      centerSize: fitted.centerSize,
      bottomSide: null,
      rightSide: null,
      centerBadge: fitted.badge,
      bottomBadge: null,
      rightBadge: null,
    };
  };

  if (!canShowSideLabels(rect)) {
    return compactLayout();
  }

  // Full: маркировка в центре, ширина снизу, высота справа — без дубля размера в центре
  const markingBlock = buildMarkingOnlyBlock(centerX, centerY, marking);
  let centerBadge = markingBlock.badge;
  // Если бейдж шире детали — ужимаем через compact
  if (
    centerBadge.widthMm + (LABEL_INSET_MM + LABEL_BADGE_STROKE_MM) * 2 > rect.widthMm ||
    centerBadge.heightMm + (LABEL_INSET_MM + LABEL_BADGE_STROKE_MM) * 2 > rect.heightMm
  ) {
    return compactLayout();
  }
  centerBadge = {
    ...centerBadge,
    xMm: centerX - centerBadge.widthMm / 2,
    yMm: centerY - centerBadge.heightMm / 2,
  };

  const bottomText = String(Math.round(rect.widthMm));
  const rightText = String(Math.round(rect.heightMm));
  const bottomBadgeHeight = LABEL_SIDE_FONT_MM + SIDE_BADGE_PAD_MM * 2;
  const rightLocalBadge = buildSingleLineBadge(rightText, LABEL_SIDE_FONT_MM);
  const rightHorizExtent = rightLocalBadge.heightMm;

  const bottomCenterY =
    rect.yMm +
    rect.heightMm -
    LABEL_INSET_MM -
    LABEL_BADGE_STROKE_MM -
    bottomBadgeHeight / 2;

  const bottomBadge = clampBadgeToRect(
    buildFlatSingleLineBadge(bottomText, LABEL_SIDE_FONT_MM, centerX, bottomCenterY),
    rect,
  );

  const rightAnchorX =
    rect.xMm + rect.widthMm - LABEL_INSET_MM - LABEL_BADGE_STROKE_MM - rightHorizExtent / 2;
  const rightAabb = rightBadgeAabb(rightAnchorX, centerY, rightLocalBadge);

  // На тесных деталях (например 200×200) бока наезжают на центр → compact
  if (
    badgesOverlap(centerBadge, bottomBadge) ||
    badgesOverlap(centerBadge, rightAabb) ||
    badgesOverlap(bottomBadge, rightAabb)
  ) {
    return compactLayout();
  }

  const bottomSide: PartLabelText = {
    xMm: centerX,
    yMm: bottomCenterY,
    fontSizeMm: LABEL_SIDE_FONT_MM,
    text: bottomText,
    textAnchor: "middle",
    dominantBaseline: "middle",
  };

  const rightSide: PartLabelText = {
    xMm: rightAnchorX,
    yMm: centerY,
    fontSizeMm: LABEL_SIDE_FONT_MM,
    text: rightText,
    textAnchor: "middle",
    dominantBaseline: "middle",
    rotateDeg: -90,
  };

  return {
    mode: "full",
    marking: {
      ...markingBlock.marking,
      xMm: centerX,
      yMm: centerY,
    },
    centerSize: null,
    bottomSide,
    rightSide,
    centerBadge,
    bottomBadge,
    rightBadge: rightLocalBadge,
  };
}

/** Стабильный порядок обрезков на листе: снизу вверх, слева направо (координаты движка). */
export function sortOffcutsForLabeling<T extends { xMm: number; yMm: number }>(
  offcuts: T[],
): T[] {
  return [...offcuts].sort((left, right) => {
    if (left.yMm !== right.yMm) {
      return left.yMm - right.yMm;
    }
    return left.xMm - right.xMm;
  });
}

export function formatOffcutMarking(index: number): string {
  return String(index);
}

/** Ниже этого short side бейдж внутри обрезка читается плохо → выноска. */
export const OFFCUT_CALLOUT_SHORT_SIDE_MM = 120;
const CALLOUT_OUTSIDE_GAP_MM = 20;
const CALLOUT_FONT_MARK_MM = 22;
const CALLOUT_FONT_SIZE_MM = 20;
const CALLOUT_PAD_X_MM = 12;
const CALLOUT_PAD_Y_MM = 10;
const CALLOUT_LINE_GAP_MM = 6;

export type OffcutCalloutDirection = "top" | "bottom" | "left" | "right";

export type OffcutLabelLayout =
  | { type: "inline"; layout: PartLabelLayout }
  | {
      type: "callout";
      direction: OffcutCalloutDirection;
      anchorXMm: number;
      anchorYMm: number;
      leaderEndXMm: number;
      leaderEndYMm: number;
      badge: LabelBadge;
      marking: PartLabelText;
      size: PartLabelText;
    };

function badgeFitsInsideRect(badge: LabelBadge, rect: MmRect): boolean {
  const inset = LABEL_INSET_MM + LABEL_BADGE_STROKE_MM;
  return (
    badge.widthMm + inset * 2 <= rect.widthMm &&
    badge.heightMm + inset * 2 <= rect.heightMm
  );
}

function pickOffcutCalloutDirection(
  rect: MmRect,
  sheet: { widthMm: number; heightMm: number },
): OffcutCalloutDirection {
  const space = {
    top: rect.yMm,
    bottom: sheet.heightMm - (rect.yMm + rect.heightMm),
    left: rect.xMm,
    right: sheet.widthMm - (rect.xMm + rect.widthMm),
  };
  // У края листа — в поле (padding), а не внутрь на раскладку деталей
  const hugEdgeMm = 80;

  if (rect.widthMm >= rect.heightMm) {
    if (space.top <= hugEdgeMm && space.top <= space.bottom) return "top";
    if (space.bottom <= hugEdgeMm && space.bottom <= space.top) return "bottom";
    return space.top >= space.bottom ? "top" : "bottom";
  }

  if (space.right <= hugEdgeMm && space.right <= space.left) return "right";
  if (space.left <= hugEdgeMm && space.left <= space.right) return "left";
  return space.right >= space.left ? "right" : "left";
}

function buildCalloutTwoLine(marking: string, sizeText: string) {
  const widthMm =
    Math.max(
      estimateTextWidthMm(marking, CALLOUT_FONT_MARK_MM),
      estimateTextWidthMm(sizeText, CALLOUT_FONT_SIZE_MM),
    ) +
    CALLOUT_PAD_X_MM * 2;
  const heightMm =
    CALLOUT_PAD_Y_MM * 2 +
    CALLOUT_FONT_MARK_MM +
    CALLOUT_LINE_GAP_MM +
    CALLOUT_FONT_SIZE_MM;

  return { widthMm, heightMm, marking, sizeText };
}

/** Бейдж всегда снаружи листа (в padding), Y — по центру обрезка. */
function placeCalloutBadgeOutsideSheet(
  rect: MmRect,
  badgeSize: { widthMm: number; heightMm: number },
  direction: OffcutCalloutDirection,
  sheet: { widthMm: number; heightMm: number },
  canvas: MmRect,
): LabelBadge {
  const centerY = rect.yMm + rect.heightMm / 2;
  const centerX = rect.xMm + rect.widthMm / 2;

  let xMm: number;
  let yMm: number;

  if (direction === "right") {
    xMm = sheet.widthMm + CALLOUT_OUTSIDE_GAP_MM;
    yMm = centerY - badgeSize.heightMm / 2;
  } else if (direction === "left") {
    xMm = -CALLOUT_OUTSIDE_GAP_MM - badgeSize.widthMm;
    yMm = centerY - badgeSize.heightMm / 2;
  } else if (direction === "top") {
    xMm = centerX - badgeSize.widthMm / 2;
    yMm = -CALLOUT_OUTSIDE_GAP_MM - badgeSize.heightMm;
  } else {
    xMm = centerX - badgeSize.widthMm / 2;
    yMm = sheet.heightMm + CALLOUT_OUTSIDE_GAP_MM;
  }

  const minX = canvas.xMm + LABEL_BADGE_STROKE_MM;
  const minY = canvas.yMm + LABEL_BADGE_STROKE_MM;
  const maxX = canvas.xMm + canvas.widthMm - LABEL_BADGE_STROKE_MM - badgeSize.widthMm;
  const maxY = canvas.yMm + canvas.heightMm - LABEL_BADGE_STROKE_MM - badgeSize.heightMm;

  // Для left/right не затаскивать бейдж обратно на лист — только вертикальный clamp
  if (direction === "right" || direction === "left") {
    return {
      xMm: clamp(xMm, minX, Math.max(minX, maxX)),
      yMm: clamp(yMm, minY, Math.max(minY, maxY)),
      widthMm: badgeSize.widthMm,
      heightMm: badgeSize.heightMm,
    };
  }

  return {
    xMm: clamp(xMm, minX, Math.max(minX, maxX)),
    yMm: clamp(yMm, minY, Math.max(minY, maxY)),
    widthMm: badgeSize.widthMm,
    heightMm: badgeSize.heightMm,
  };
}

function leaderEndOnBadge(
  badge: LabelBadge,
  direction: OffcutCalloutDirection,
): { xMm: number; yMm: number } {
  const cx = badge.xMm + badge.widthMm / 2;
  const cy = badge.yMm + badge.heightMm / 2;

  if (direction === "top") return { xMm: cx, yMm: badge.yMm + badge.heightMm };
  if (direction === "bottom") return { xMm: cx, yMm: badge.yMm };
  if (direction === "left") return { xMm: badge.xMm + badge.widthMm, yMm: cy };
  return { xMm: badge.xMm, yMm: cy };
}

/** Подпись обрезка: внутри, если влезает; иначе выноска в поле листа. */
export function buildOffcutLabelLayout(
  rect: MmRect,
  marking: string,
  partWidthMm: number,
  partHeightMm: number,
  sheet: { widthMm: number; heightMm: number },
  canvas: MmRect,
): OffcutLabelLayout {
  const sizeText = `${partWidthMm}×${partHeightMm}`;
  const centerX = rect.xMm + rect.widthMm / 2;
  const centerY = rect.yMm + rect.heightMm / 2;
  const compact = buildCenterBlock(centerX, centerY, marking, sizeText);
  const shortSide = Math.min(rect.widthMm, rect.heightMm);

  const needsCallout =
    shortSide < OFFCUT_CALLOUT_SHORT_SIDE_MM || !badgeFitsInsideRect(compact.badge, rect);

  if (!needsCallout) {
    return {
      type: "inline",
      layout: buildPartLabelLayout(rect, marking, partWidthMm, partHeightMm),
    };
  }

  const content = buildCalloutTwoLine(marking, sizeText);
  const direction = pickOffcutCalloutDirection(rect, sheet);
  const badge = placeCalloutBadgeOutsideSheet(
    rect,
    { widthMm: content.widthMm, heightMm: content.heightMm },
    direction,
    sheet,
    canvas,
  );
  const leader = leaderEndOnBadge(badge, direction);
  const badgeCenterX = badge.xMm + badge.widthMm / 2;
  const markingY = badge.yMm + CALLOUT_PAD_Y_MM + CALLOUT_FONT_MARK_MM / 2;
  const sizeY =
    markingY +
    CALLOUT_FONT_MARK_MM / 2 +
    CALLOUT_LINE_GAP_MM +
    CALLOUT_FONT_SIZE_MM / 2;

  return {
    type: "callout",
    direction,
    anchorXMm: centerX,
    anchorYMm: centerY,
    leaderEndXMm: leader.xMm,
    leaderEndYMm: leader.yMm,
    badge,
    marking: {
      xMm: badgeCenterX,
      yMm: markingY,
      fontSizeMm: CALLOUT_FONT_MARK_MM,
      text: marking,
      textAnchor: "middle",
      dominantBaseline: "middle",
    },
    size: {
      xMm: badgeCenterX,
      yMm: sizeY,
      fontSizeMm: CALLOUT_FONT_SIZE_MM,
      text: sizeText,
      textAnchor: "middle",
      dominantBaseline: "middle",
    },
  };
}
