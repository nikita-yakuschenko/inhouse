"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PROJECT_TABS = ["parts", "cut", "operations"] as const;
export type ProjectTab = (typeof PROJECT_TABS)[number];

function isProjectTab(value: string | null | undefined): value is ProjectTab {
  return PROJECT_TABS.includes(value as ProjectTab);
}

export function ProjectTabs({
  initialTab,
  parts,
  cut,
  operations,
}: {
  initialTab?: string;
  parts: ReactNode;
  cut: ReactNode;
  operations: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabFromUrl = searchParams.get("tab");
  const activeTab = isProjectTab(tabFromUrl)
    ? tabFromUrl
    : isProjectTab(initialTab)
      ? initialTab
      : "parts";

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="px-4 lg:px-6">
      <TabsList>
        <TabsTrigger value="parts">Детали</TabsTrigger>
        <TabsTrigger value="cut">Расчёт</TabsTrigger>
        <TabsTrigger value="operations">Операции</TabsTrigger>
      </TabsList>

      <TabsContent value="parts" className="mt-4">
        {parts}
      </TabsContent>
      <TabsContent value="cut" className="mt-4">
        {cut}
      </TabsContent>
      <TabsContent value="operations" className="mt-4">
        {operations}
      </TabsContent>
    </Tabs>
  );
}
