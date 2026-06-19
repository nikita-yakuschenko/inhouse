import Link from "next/link";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { AppRole } from "@/lib/auth/roles";

export function AppBrand({ role }: { role: AppRole }) {
  const homeHref = role === "operator" ? "/operator" : "/";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" asChild tooltip="Smartcut">
          <Link href={homeHref}>
            <img
              src="/logo_smartcut.svg"
              alt="Smartcut"
              width={32}
              height={32}
              className="size-8 shrink-0 rounded-lg"
            />
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">Smartcut</span>
            </div>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
