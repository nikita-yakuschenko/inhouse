"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

import { SheetCanvas } from "@/components/cut-plan/sheet-canvas";
import type { ClientCutPlanSheet } from "@/features/projects/serialize-panels";
import { buildStructuralSheetTabSegments } from "@/lib/cut-plan/sheet-part-groups";
import { Button } from "@/components/ui/button";
import { PanelBlockHeader } from "@/components/ui/panel-block-header";
import { cn } from "@/lib/utils";

type SheetTabsPanelProps = {
  sheets: ClientCutPlanSheet[];
  parts: { id: string; quantity: number }[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  groupedSheetIndices?: number[] | null;
};

type OverlayFrame = {
  left: number;
  top: number;
  width: number;
  height: number;
  visible: boolean;
};

const tabButtonClass = "h-8 min-w-[5.25rem] px-4";

const groupShellClass =
  "relative inline-flex h-10 shrink-0 items-center gap-0.5 p-1";

function segmentKey(indices: number[]) {
  return indices.join("-");
}

function tabClass(isActive: boolean, inGroupedShell: boolean) {
  return cn(
    "relative z-10 inline-flex shrink-0 snap-center items-center justify-center rounded-md text-sm font-medium",
    "transition-colors duration-300 ease-out",
    tabButtonClass,
    isActive
      ? "text-primary-foreground"
      : cn(
          "text-muted-foreground hover:text-foreground",
          !inGroupedShell && "hover:bg-background",
        ),
  );
}

export function SheetTabsPanel({
  sheets,
  parts,
  activeIndex,
  onActiveIndexChange,
  groupedSheetIndices = null,
}: SheetTabsPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const tablistRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<number, HTMLButtonElement>());
  const groupShellRefs = useRef(new Map<string, HTMLDivElement>());
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [groupField, setGroupField] = useState<OverlayFrame>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    visible: false,
  });
  const [activePill, setActivePill] = useState<OverlayFrame>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    visible: false,
  });

  const activeSheet = sheets[activeIndex] ?? sheets[0];
  const showTabs = sheets.length > 1;
  const hasGroup = Boolean(groupedSheetIndices && groupedSheetIndices.length >= 2);
  const activeGroupKey = hasGroup && groupedSheetIndices
    ? segmentKey(groupedSheetIndices)
    : null;

  const tabSegments = useMemo(
    () => buildStructuralSheetTabSegments(sheets, parts),
    [parts, sheets],
  );

  const updateOverlays = useCallback(() => {
    const tablist = tablistRef.current;
    if (!tablist) return;

    const tablistRect = tablist.getBoundingClientRect();

    if (activeGroupKey) {
      const groupShell = groupShellRefs.current.get(activeGroupKey);
      if (!groupShell) {
        setGroupField((prev) => ({ ...prev, visible: false }));
      } else {
        const shellRect = groupShell.getBoundingClientRect();
        setGroupField({
          left: shellRect.left - tablistRect.left,
          top: shellRect.top - tablistRect.top,
          width: shellRect.width,
          height: shellRect.height,
          visible: true,
        });
      }
    } else {
      setGroupField((prev) => ({ ...prev, visible: false }));
    }

    const activeTab = tabRefs.current.get(activeIndex);
    if (!activeTab) {
      setActivePill((prev) => ({ ...prev, visible: false }));
      return;
    }

    const activeRect = activeTab.getBoundingClientRect();
    setActivePill({
      left: activeRect.left - tablistRect.left,
      top: activeRect.top - tablistRect.top,
      width: activeRect.width,
      height: activeRect.height,
      visible: true,
    });
  }, [activeGroupKey, activeIndex]);

  useLayoutEffect(() => {
    updateOverlays();
  }, [updateOverlays, tabSegments]);

  useEffect(() => {
    const scrollNode = scrollRef.current;
    const tablistNode = tablistRef.current;
    if (!scrollNode || !tablistNode) return;

    const onChange = () => updateOverlays();
    scrollNode.addEventListener("scroll", onChange, { passive: true });
    window.addEventListener("resize", onChange);

    const observer = new ResizeObserver(onChange);
    observer.observe(tablistNode);
    observer.observe(scrollNode);

    for (const shell of groupShellRefs.current.values()) {
      observer.observe(shell);
    }

    return () => {
      scrollNode.removeEventListener("scroll", onChange);
      window.removeEventListener("resize", onChange);
      observer.disconnect();
    };
  }, [tabSegments, updateOverlays]);

  const updateScrollHints = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;

    const maxScroll = node.scrollWidth - node.clientWidth;
    setCanScrollLeft(node.scrollLeft > 4);
    setCanScrollRight(node.scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    const tab = tabRefs.current.get(activeIndex);
    tab?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeIndex]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;

    updateScrollHints();

    const onScroll = () => updateScrollHints();
    node.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      node.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [sheets.length, tabSegments, updateScrollHints]);

  function scrollTabs(direction: -1 | 1) {
    scrollRef.current?.scrollBy({
      left: direction * Math.max(160, scrollRef.current.clientWidth * 0.6),
      behavior: "smooth",
    });
  }

  function selectSheet(index: number) {
    const next = Math.max(0, Math.min(index, sheets.length - 1));
    onActiveIndexChange(next);
  }

  function renderTab(index: number, inGroupedShell: boolean) {
    const sheet = sheets[index];
    const isActive = index === activeIndex;

    return (
      <button
        key={sheet.id}
        type="button"
        role="tab"
        aria-selected={isActive}
        tabIndex={isActive ? 0 : -1}
        ref={(node) => {
          if (node) {
            tabRefs.current.set(index, node);
          } else {
            tabRefs.current.delete(index);
          }
        }}
        onClick={() => selectSheet(index)}
        className={tabClass(isActive, inGroupedShell)}
      >
        Лист {sheet.sheetIndex}
      </button>
    );
  }

  if (!activeSheet) {
    return null;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-card">
      {showTabs ? (
        <PanelBlockHeader className="relative overflow-hidden p-0 lg:p-0">
          {canScrollLeft ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-muted/40 to-transparent sm:left-10"
            />
          ) : null}
          {canScrollRight ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-muted/40 to-transparent sm:right-10"
            />
          ) : null}

          <div className="flex h-12 items-stretch overflow-hidden">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden h-12 w-10 shrink-0 rounded-none sm:inline-flex"
              disabled={!canScrollLeft}
              onClick={() => scrollTabs(-1)}
              aria-label="Прокрутить вкладки влево"
            >
              <IconChevronLeft className="size-4" />
            </Button>

            <div
              ref={scrollRef}
              className={cn(
                "min-w-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain",
                "scroll-smooth touch-pan-x snap-x snap-mandatory",
                "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
              )}
            >
              <div
                ref={tablistRef}
                role="tablist"
                aria-label="Листы раскроя"
                className="relative inline-flex h-12 w-max items-center gap-1.5 px-2"
              >
                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute z-0 rounded-lg border border-black/5 bg-white",
                    "shadow-[inset_0_1px_3px_rgba(0,0,0,0.12)]",
                    "transition-[left,top,width,height,opacity] duration-300 ease-out",
                    groupField.visible ? "opacity-100" : "opacity-0",
                  )}
                  style={{
                    left: groupField.left,
                    top: groupField.top,
                    width: groupField.width,
                    height: groupField.height,
                  }}
                />

                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute z-[1] rounded-md bg-primary shadow-sm",
                    "transition-[left,top,width,height,opacity] duration-300 ease-out",
                    activePill.visible ? "opacity-100" : "opacity-0",
                  )}
                  style={{
                    left: activePill.left,
                    top: activePill.top,
                    width: activePill.width,
                    height: activePill.height,
                  }}
                />

                {tabSegments.map((segment) => {
                  if (segment.kind === "group") {
                    const key = segmentKey(segment.indices);

                    return (
                      <div
                        key={`group-slot-${key}`}
                        ref={(node) => {
                          if (node) {
                            groupShellRefs.current.set(key, node);
                          } else {
                            groupShellRefs.current.delete(key);
                          }
                        }}
                        className={groupShellClass}
                        role="presentation"
                      >
                        {segment.indices.map((index) => renderTab(index, true))}
                      </div>
                    );
                  }

                  return renderTab(segment.indices[0], false);
                })}
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden h-12 w-10 shrink-0 rounded-none sm:inline-flex"
              disabled={!canScrollRight}
              onClick={() => scrollTabs(1)}
              aria-label="Прокрутить вкладки вправо"
            >
              <IconChevronRight className="size-4" />
            </Button>
          </div>
        </PanelBlockHeader>
      ) : null}

      <div className="min-h-0 flex-1">
        <SheetCanvas embedded showTitle={!showTabs} {...activeSheet} sheetIndex={activeSheet.sheetIndex} />
      </div>
    </div>
  );
}
