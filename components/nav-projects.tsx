"use client";

import Link from "next/link";
import { IconDots, IconFolder } from "@tabler/icons-react";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function NavProjects({
  projects,
  projectHref,
  recentLabel = "Недавние проекты",
  listAllLabel = "Все проекты",
}: {
  projects: {
    id: string;
    name: string;
  }[];
  projectHref: (projectId: string) => string;
  recentLabel?: string;
  listAllLabel?: string;
}) {
  if (projects.length === 0) {
    return null;
  }

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>{recentLabel}</SidebarGroupLabel>
      <SidebarMenu>
        {projects.map((project) => (
          <SidebarMenuItem key={project.id}>
            <SidebarMenuButton asChild>
              <Link href={projectHref(project.id)}>
                <IconFolder />
                <span>{project.name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
        <SidebarMenuItem>
          <SidebarMenuButton asChild className="text-sidebar-foreground/70">
            <Link href="/">
              <IconDots className="text-sidebar-foreground/70" />
              <span>{listAllLabel}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}
