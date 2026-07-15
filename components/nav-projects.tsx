"use client";

import Link from "next/link";

import { ProjectIcon } from "@/components/projects/project-icon";
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
}: {
  projects: {
    id: string;
    name: string;
  }[];
  projectHref: (projectId: string) => string;
  recentLabel?: string;
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
                <ProjectIcon projectId={project.id} className="size-4" />
                <span>{project.name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
