"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PanelListItem = {
  id: string;
  name: string;
  code?: string | null;
  partsCount: number;
  hasCutPlan: boolean;
};

export function PanelSelector({
  panels,
  activePanelId,
}: {
  panels: PanelListItem[];
  activePanelId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function selectPanel(panelId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("panel", panelId);
    params.delete("sheet");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  if (panels.length === 0) {
    return (
      <div className="shrink-0 border-b px-4 py-2 text-sm text-muted-foreground lg:px-6">
        В проекте нет панелей для раскроя
      </div>
    );
  }

  if (panels.length <= 1) {
    return null;
  }

  return (
    <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2 lg:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {panels.map((panel) => (
          <Button
            key={panel.id}
            type="button"
            size="sm"
            variant={panel.id === activePanelId ? "default" : "outline"}
            className={cn("shrink-0")}
            onClick={() => selectPanel(panel.id)}
            title={panel.name}
          >
            {panel.code?.trim() || panel.name}
            <span className="ml-1 text-xs opacity-70">({panel.partsCount})</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
