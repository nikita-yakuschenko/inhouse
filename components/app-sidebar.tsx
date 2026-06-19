"use client";

import * as React from "react";

import { AppBrand } from "@/components/app-brand";
import { NavMain } from "@/components/nav-main";
import { NavProjects } from "@/components/nav-projects";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { getSidebarNav } from "@/lib/auth/nav";
import type { AppRole } from "@/lib/auth/roles";

const demoUser = {
  name: "Демо-пользователь",
  email: "demo@smartcut.local",
  avatar: "",
};

export function AppSidebar({
  role,
  recentProjects,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  role: AppRole;
  recentProjects: { id: string; name: string }[];
}) {
  const nav = getSidebarNav(role);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <AppBrand role={role} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={nav.items} groupLabel={nav.groupLabel} />
        {nav.showRecentProjects ? (
          <NavProjects projects={recentProjects} projectHref={nav.projectHref} />
        ) : null}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={demoUser} role={role} />
      </SidebarFooter>
    </Sidebar>
  );
}
