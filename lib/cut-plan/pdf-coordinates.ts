const MM_TO_PT = 72 / 25.4;

export function mmToPt(mm: number) {
  return mm * MM_TO_PT;
}

export function ptToMm(pt: number) {
  return pt / MM_TO_PT;
}

export type PdfRgb = {
  r: number;
  g: number;
  b: number;
};

export const PDF_COLORS = {
  sheetStroke: { r: 0.2, g: 0.25, b: 0.33 },
  usableStroke: { r: 0.58, g: 0.65, b: 0.71 },
  partFill: { r: 0.99, g: 0.64, b: 0.69 },
  partStroke: { r: 0.88, g: 0.11, b: 0.28 },
  partLabel: { r: 0.53, g: 0.07, b: 0.22 },
  offcutFill: { r: 0.95, g: 0.96, b: 0.98 },
  offcutStroke: { r: 0.39, g: 0.45, b: 0.51 },
  offcutLabel: { r: 0.2, g: 0.25, b: 0.33 },
  cutAxis: { r: 0.58, g: 0.65, b: 0.71 },
  cutLine: { r: 0.86, g: 0.15, b: 0.15 },
  text: { r: 0.07, g: 0.09, b: 0.15 },
  mutedText: { r: 0.42, g: 0.45, b: 0.5 },
} as const satisfies Record<string, PdfRgb>;

export type MapSlotMm = {
  xMm: number;
  yTopMm: number;
  widthMm: number;
  heightMm: number;
};

export type MapViewport = {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
};

export function createMapCoordinateMapper(
  slot: MapSlotMm,
  viewBox: MapViewport,
  pageHeightPt: number,
) {
  const scale = Math.min(slot.widthMm / viewBox.widthMm, slot.heightMm / viewBox.heightMm);
  const drawnWidthMm = viewBox.widthMm * scale;
  const drawnHeightMm = viewBox.heightMm * scale;
  const offsetXMm = slot.xMm + (slot.widthMm - drawnWidthMm) / 2;
  const offsetYTopMm = slot.yTopMm + (slot.heightMm - drawnHeightMm) / 2;

  return {
    scale,
    mapPoint(xMm: number, yMm: number) {
      const xPt = mmToPt(offsetXMm + (xMm - viewBox.xMm) * scale);
      const yFromTopPt = mmToPt(offsetYTopMm + (yMm - viewBox.yMm) * scale);
      return {
        x: xPt,
        y: pageHeightPt - yFromTopPt,
      };
    },
    mapRect(rect: { xMm: number; yMm: number; widthMm: number; heightMm: number }) {
      const topLeft = this.mapPoint(rect.xMm, rect.yMm);
      const bottomRight = this.mapPoint(rect.xMm + rect.widthMm, rect.yMm + rect.heightMm);
      return {
        x: Math.min(topLeft.x, bottomRight.x),
        y: Math.min(topLeft.y, bottomRight.y),
        width: Math.abs(bottomRight.x - topLeft.x),
        height: Math.abs(topLeft.y - bottomRight.y),
      };
    },
    mapLength(lengthMm: number) {
      return mmToPt(lengthMm * scale);
    },
  };
}
