"use client";

import { IconPlus } from "@tabler/icons-react";

import {
  CreateProjectForm,
  type CatalogMachineOption,
  type CatalogMaterialOption,
  type CatalogSheetFormatOption,
} from "@/components/projects/create-project-form";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function NewCalculationSheet({
  labels,
  materials,
  sheetFormats,
  machineProfiles,
}: {
  labels: { newItem: string; createSubmit: string };
  materials: CatalogMaterialOption[];
  sheetFormats: CatalogSheetFormatOption[];
  machineProfiles: CatalogMachineOption[];
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button">
          <IconPlus className="size-4" />
          {labels.newItem}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[min(32rem,calc(100vw-2rem))] overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{labels.newItem}</SheetTitle>
          <SheetDescription>
            Выберите плитный раскрой или погонаж, затем укажите параметры проекта.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <CreateProjectForm
            submitLabel={labels.createSubmit}
            materials={materials}
            sheetFormats={sheetFormats}
            machineProfiles={machineProfiles}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
