/**
 * Сборка спроса и эффективных длин заготовок (фаски) — как в smartcut-калькуляторе.
 */

export type PieceInput = {
  id: string;
  label: string;
  /** наружная длина, мм */
  outerMm: number;
  /** внутренняя длина, мм — 0 если не задана */
  innerMm: number;
  quantity: number;
};

export type StockInput = {
  id: string;
  lengthMm: number;
  /** null = без лимита */
  quantity: number | null;
};

export function computeMiterDeltaMm(pieces: PieceInput[]): number {
  let maxDeltaMm = 0;
  for (const p of pieces) {
    if (p.innerMm <= 0) continue;
    const avgMm = (p.outerMm + p.innerMm) / 2;
    maxDeltaMm = Math.max(maxDeltaMm, p.outerMm - avgMm);
  }
  return maxDeltaMm;
}

export function pieceDemandLengthMm(piece: PieceInput): number {
  if (piece.innerMm > 0) {
    return Math.round((piece.outerMm + piece.innerMm) / 2);
  }
  return Math.round(piece.outerMm);
}

export function effectiveStockLengthMm(
  stockLengthMm: number,
  applyMiter: boolean,
  maxDeltaMm: number,
): number {
  if (!applyMiter || maxDeltaMm <= 0) return stockLengthMm;
  return stockLengthMm - maxDeltaMm;
}
