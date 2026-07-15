import {
  IconBooks,
  IconClipboardList,
  IconLayoutKanban,
  IconSettings,
} from "@tabler/icons-react";

import type { NavMainItem } from "@/components/nav-main";
import type { AppRole } from "@/lib/auth/roles";

export type SidebarNavConfig = {
  groupLabel: string;
  items: NavMainItem[];
  projectHref: (projectId: string) => string;
  showRecentProjects: boolean;
  recentLabel: string;
};

const estimatorNav: SidebarNavConfig = {
  groupLabel: "Работа",
  projectHref: (projectId) => `/projects/${projectId}`,
  showRecentProjects: true,
  recentLabel: "Недавние расчёты",
  items: [
    {
      title: "Расчёты",
      url: "/",
      icon: IconLayoutKanban,
    },
    {
      title: "Справочники",
      url: "/catalog",
      icon: IconBooks,
      items: [
        { title: "Материалы", url: "/catalog/materials" },
      ],
    },
    {
      title: "Настройки",
      url: "/settings",
      icon: IconSettings,
      items: [
        { title: "Оборудование", url: "/settings/equipment" },
      ],
    },
  ],
};

const operatorNav: SidebarNavConfig = {
  groupLabel: "Смена",
  projectHref: (projectId) => `/operator/projects/${projectId}`,
  showRecentProjects: false,
  recentLabel: "Недавние задания",
  items: [
    {
      title: "Задания",
      url: "/operator",
      icon: IconClipboardList,
    },
  ],
};

export function getSidebarNav(role: AppRole): SidebarNavConfig {
  return role === "operator" ? operatorNav : estimatorNav;
}
