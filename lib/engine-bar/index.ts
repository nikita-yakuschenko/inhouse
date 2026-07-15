export {
  MAX_EXACT_PIECES,
  STOCK_UNLIMITED,
  barPatternKey,
  cumulativePositionsMm,
  expandDemands,
  groupConsecutiveIdenticalBars,
  mergeStockSpecs,
  segmentBoundariesMm,
  solveCutting,
  solveCuttingFromStocks,
  solveFFD,
  solveMultiStockFFD,
  validateDemands,
} from "@/lib/engine-bar/cutting";

export type {
  BarLayout,
  CuttingResult,
  DemandItem,
  PlacedPiece,
  StockSpec,
} from "@/lib/engine-bar/cutting";
