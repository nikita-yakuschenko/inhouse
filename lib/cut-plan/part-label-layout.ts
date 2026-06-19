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

export function buildPartLabelLayout(
  rect: MmRect,
  marking: string,
  partWidthMm: number,
  partHeightMm: number,
): PartLabelLayout {
  const centerX = rect.xMm + rect.widthMm / 2;
  const centerY = rect.yMm + rect.heightMm / 2;
  const showSides = canShowSideLabels(rect);
  const sizeText = `${partWidthMm}×${partHeightMm}`;

  const centerBlock = buildCenterBlock(centerX, centerY, marking, sizeText);
  const centerBadge = clampBadgeToRect(centerBlock.badge, rect);

  if (!showSides) {
    return {
      mode: "compact",
      marking: centerBlock.marking,
      centerSize: centerBlock.centerSize,
      bottomSide: null,
      rightSide: null,
      centerBadge,
      bottomBadge: null,
      rightBadge: null,
    };
  }

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

  const bottomSide: PartLabelText = {
    xMm: centerX,
    yMm: bottomCenterY,
    fontSizeMm: LABEL_SIDE_FONT_MM,
    text: bottomText,
    textAnchor: "middle",
    dominantBaseline: "middle",
  };

  const rightAnchorX =
    rect.xMm + rect.widthMm - LABEL_INSET_MM - LABEL_BADGE_STROKE_MM - rightHorizExtent / 2;
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
    marking: centerBlock.marking,
    centerSize: centerBlock.centerSize,
    bottomSide,
    rightSide,
    centerBadge,
    bottomBadge: clampBadgeToRect(
      buildFlatSingleLineBadge(bottomText, LABEL_SIDE_FONT_MM, centerX, bottomCenterY),
      rect,
    ),
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
