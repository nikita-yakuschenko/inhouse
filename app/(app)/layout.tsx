import { AppSidebar } from "@/components/app-sidebar";
import { getProjects } from "@/features/projects/queries";
import { readAppRoleFromCookie, ROLE_COOKIE_NAME } from "@/lib/auth/roles";
import { readSidebarOpenFromCookie, SIDEBAR_COOKIE_NAME } from "@/lib/sidebar-cookie";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const projects = await getProjects();
  const recentProjects = projects.slice(0, 5).map((project) => ({
    id: project.id,
    name: project.name,
  }));

  const cookieStore = await cookies();
  const defaultOpen = readSidebarOpenFromCookie(
    cookieStore.get(SIDEBAR_COOKIE_NAME)?.value,
  );
  const role = readAppRoleFromCookie(cookieStore.get(ROLE_COOKIE_NAME)?.value);

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      className="h-svh min-h-svh overflow-hidden"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" role={role} recentProjects={recentProjects} />
      <SidebarInset className="min-h-0 overflow-hidden">{children}</SidebarInset>
    </SidebarProvider>
  );
}
