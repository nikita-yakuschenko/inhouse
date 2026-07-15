import type {
  ClientCutOperation,
  ClientCutPlanSheet,
  ClientPart,
  ClientPlacement,
} from "@/features/projects/serialize-panels";
import { resolvePlacementMarking } from "@/lib/engine/validation";

export type OperationsSheetContext = {
  placementLabel: string;
};

const CUT_OPERATION_TYPES = new Set(["full_cut"]);

export type OperatorWorkflowStep = {
  id: string;
  sequenceNumber: number;
  description: string;
};

/** Разворачивает технические операции в пошаговый маршрут для оператора. */
export function buildOperatorWorkflowSteps(
  operations: ClientCutOperation[],
  placements: Pick<ClientPlacement, "label">[],
): OperatorWorkflowStep[] {
  const steps: OperatorWorkflowStep[] = [];
  let sequenceNumber = 1;

  const push = (description: string, sourceId?: string) => {
    steps.push({
      id: sourceId ? `${sourceId}-workflow-${sequenceNumber}` : `workflow-${sequenceNumber}`,
      sequenceNumber: sequenceNumber++,
      description,
    });
  };

  push("Установить заготовку");

  const cutOperations = operations
    .filter((operation) => CUT_OPERATION_TYPES.has(operation.operationType))
    .sort((left, right) => left.sequenceNumber - right.sequenceNumber);

  cutOperations.forEach((operation, index) => {
    const cutNumber = index + 1;
    push(`Выполнить позиционирование пилы для реза № ${cutNumber}`);
    push(`Выполнить рез № ${cutNumber}`, operation.id);
    push(`Отделить и удалить обрезок № ${cutNumber}`);
  });

  const labelOperations = operations
    .filter((operation) => operation.operationType === "label_part")
    .sort((left, right) => left.sequenceNumber - right.sequenceNumber);

  if (labelOperations.length > 0) {
    labelOperations.forEach((operation) => {
      const label = operation.note?.replace(/^Маркировка детали /, "");
      push(
        label
          ? `Нанести маркировку на деталь ${label}`
          : "Нанести маркировку на деталь",
        operation.id,
      );
    });
  } else {
    placements.forEach((placement) => {
      push(`Нанести маркировку на деталь ${placement.label}`);
    });
  }

  placements.forEach((placement) => {
    push(`Извлечь готовую деталь ${placement.label}`);
    push(`Разместить готовую деталь ${placement.label} в месте складирования`);
  });

  return steps;
}

/** Контекст детали для заголовка sheet «Порядок операций». */
export function resolveOperationsSheetContext(
  sheet: ClientCutPlanSheet,
  parts: ClientPart[],
): OperationsSheetContext | null {
  const placement = sheet.placements[0];
  if (!placement) {
    return null;
  }

  const part = parts.find((item) => item.id === placement.partId);
  const partMark = part?.name ?? placement.label.replace(/ - \d+$/, "");

  return {
    placementLabel: resolvePlacementMarking(placement.label || partMark, placement.partInstanceIndex),
  };
}

/** @deprecated Используйте buildOperatorWorkflowSteps для UI оператора. */
export function getOperatorWorkflowOperations(
  operations: ClientCutOperation[],
): ClientCutOperation[] {
  return operations.filter(
    (operation) =>
      CUT_OPERATION_TYPES.has(operation.operationType) ||
      operation.operationType === "label_part",
  );
}

export function getOperatorCutOperations(
  operations: ClientCutOperation[],
): ClientCutOperation[] {
  return operations.filter((operation) => CUT_OPERATION_TYPES.has(operation.operationType));
}
