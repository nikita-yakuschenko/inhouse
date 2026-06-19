"use client";

import type {
  OperationsSheetContext,
  OperatorWorkflowStep,
} from "@/lib/cut-plan/operator-operations";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/** Ширина панели: один раз заданный потолок, дальше текст сам переносится. */
const operationsSheetWidthClass =
  "w-[min(42rem,calc(100vw-2rem))] sm:max-w-[min(42rem,calc(100vw-2rem))]";

const operationsRowClass = "flex items-center gap-x-4 px-5 py-3.5";

export function OperationsSheet({
  steps,
  context,
}: {
  steps: OperatorWorkflowStep[];
  context: OperationsSheetContext | null;
}) {
  if (steps.length === 0) {
    return null;
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" size="sm" variant="default">
          Порядок операций
        </Button>
      </SheetTrigger>
      <SheetContent
        className={cn(
          operationsSheetWidthClass,
          "flex flex-col gap-0 rounded-xl border p-0 shadow-xl",
          "inset-y-4 right-4 left-auto h-auto max-h-[calc(100vh-2rem)]",
        )}
      >
        <SheetHeader className="space-y-3 border-b px-6 py-4 pr-12">
          <SheetTitle className="text-base font-semibold">Порядок операций</SheetTitle>
          {context ? (
            <p className="text-xl font-semibold leading-tight tracking-tight text-foreground">
              {context.placementLabel}
            </p>
          ) : null}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="w-full overflow-hidden rounded-lg border bg-card">
            <div
              className={cn(
                operationsRowClass,
                "border-b bg-muted/40 py-2.5 text-xs font-medium text-muted-foreground",
              )}
            >
              <div className="w-8 shrink-0 text-center">№</div>
              <div className="min-w-0 flex-1">Операция</div>
            </div>

            <ol className="divide-y">
              {steps.map((step) => (
                <li key={step.id} className={operationsRowClass}>
                  <div className="flex w-8 shrink-0 justify-center">
                    <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold tabular-nums text-primary-foreground">
                      {step.sequenceNumber}
                    </span>
                  </div>
                  <p className="min-w-0 flex-1 text-sm leading-snug break-words text-pretty text-foreground">
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
