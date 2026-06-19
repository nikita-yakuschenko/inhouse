export const SEED_IDS = {
  organization: "ORG00001",
  material: "MATGKL01",
  sheetFormat: "SHT25K01",
  machineProfile: "MCNVPS01",
} as const;

/** П(Ц)-1 — внутренняя плитная обшивка, OSB-3 1250×2500×22 */
export const PTC1_IDS = {
  project: "PRJPTC01",
  panel: "PNLPTC01",
  material: "MATOSB22",
  sheetFormat: "SHTOSB25",
  parts: {
    "01": "PTC1P001",
    "02": "PTC1P002",
    "03": "PTC1P003",
    "04": "PTC1P004",
    "05": "PTC1P005",
    "06": "PTC1P006",
    "07": "PTC1P007",
    "08": "PTC1P008",
  },
} as const;
