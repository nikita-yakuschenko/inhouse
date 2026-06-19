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
  listAllLabel: string;
};

const estimatorNav: SidebarNavConfig = {
  groupLabel: "Работа",
  projectHref: (projectId) => `/projects/${projectId}`,
  showRecentProjects: true,
  recentLabel: "Недавние расчёты",
  listAllLabel: "Все расчёты",
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
        { title: "Форматы листов", url: "/catalog/sheets" },
        { title: "Профили станков", url: "/catalog/machines" },
      ],
    },
    {
      title: "Настройки",
      url: "/settings",
      icon: IconSettings,
      items: [
        { title: "Организация", url: "/settings" },
        { title: "Параметры раскроя", url: "/settings/cutting" },
      ],
    },
  ],
};

const operatorNav: SidebarNavConfig = {
  groupLabel: "Смена",
  projectHref: (projectId) => `/operator/projects/${projectId}`,
  showRecentProjects: false,
  recentLabel: "Недавние задания",
  listAllLabel: "Все задания",
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
