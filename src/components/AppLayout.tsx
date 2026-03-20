import { useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3, FileText, ClipboardCheck, FolderOpen, Settings, LogOut, Shield, User, ScrollText,
} from "lucide-react";
import { toast } from "sonner";
import { OrgContext, useOrg } from "@/context/OrgContext";
import { useOrgLoader } from "@/hooks/useOrgLoader";
import { usePermissionPoller } from "@/hooks/usePermissionPoller";
import type { RolePermission, OrgMember } from "@/context/OrgContext";

// ─────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────
function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { orgName, memberName, rolePermissions, memberRole } = useOrg();

  const kanSeIndstillinger =
    rolePermissions && memberRole
      ? (rolePermissions[memberRole]?.kan_se_indstillinger ?? false)
      : false;

  const navItems = [
    { title: "Dashboard", url: "/dashboard", icon: BarChart3 },
    { title: "Møder", url: "/moeder", icon: FileText },
    { title: "Handlingspunkter", url: "/handlingspunkter", icon: ClipboardCheck },
    { title: "Dokumenter", url: "/dokumenter", icon: FolderOpen },
    { title: "Vedtægter", url: "/vedtaegter", icon: ScrollText },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logget ud.");
    navigate("/");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2 overflow-hidden">
          <Shield className="h-5 w-5 text-sidebar-primary shrink-0" />
          {!collapsed && (
            <span className="text-sm font-semibold truncate">
              {orgName || "Vedtægt"}
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {kanSeIndstillinger && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/indstillinger"
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <Settings className="h-4 w-4" />
                      {!collapsed && <span>Indstillinger</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        {!collapsed ? (
          <div className="space-y-2">
            <NavLink
              to="/profil"
              className="flex items-center gap-2 text-xs text-sidebar-foreground hover:text-sidebar-primary transition-colors"
              activeClassName="text-sidebar-primary font-medium"
            >
              <User className="h-3.5 w-3.5" />
              <span className="truncate">{memberName || "Min profil"}</span>
            </NavLink>
            <div className="flex justify-end">
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleLogout}>
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 flex flex-col items-center">
            <NavLink to="/profil" className="hover:text-sidebar-primary" activeClassName="text-sidebar-primary">
              <User className="h-3.5 w-3.5" />
            </NavLink>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleLogout}>
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

// ─────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────
function AppLoadingSkeleton() {
  return (
    <div className="min-h-screen flex w-full">
      <div className="w-16 border-r border-border" />
      <div className="flex-1 flex flex-col">
        <div className="h-12 border-b border-border" />
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full max-w-md" />
          <Skeleton className="h-4 w-full max-w-sm" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Fejlvisning
// ─────────────────────────────────────────────
function AppErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 max-w-sm">
        <Shield className="h-8 w-8 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/login";
          }}
        >
          <LogOut className="h-4 w-4 mr-1" /> Log ud
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// AppLayout
// ─────────────────────────────────────────────
interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const { orgState, loading, error, load, refetchForOrg, setOrgState } = useOrgLoader();

  useEffect(() => {
    load();
  }, [load]);

  // Callback er stabil: setOrgState fra useState ændrer sig aldrig
  const handlePermissionUpdate = useCallback(
    (rolePerms: Record<string, RolePermission> | null, orgMembers: OrgMember[]) => {
      setOrgState((prev) => ({ ...prev, rolePermissions: rolePerms, members: orgMembers }));
    },
    [setOrgState]
  );

  usePermissionPoller({
    orgId: orgState.orgId,
    onUpdate: handlePermissionUpdate,
  });

  const refetchPermissions = useCallback(async () => {
    if (!orgState.orgId) return;
    await refetchForOrg(orgState.orgId);
  }, [orgState.orgId, refetchForOrg]);

  // useMemo: context-objektet får kun ny reference når indholdet reelt ændrer sig
  const contextValue = useMemo(
    () => ({ ...orgState, refetchPermissions }),
    [orgState, refetchPermissions]
  );

  if (loading) return <AppLoadingSkeleton />;
  if (error) return <AppErrorScreen message={error} />;

  return (
    <OrgContext.Provider value={contextValue}>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-12 flex items-center border-b border-border px-4">
              <SidebarTrigger className="mr-2" />
            </header>
            <main className="flex-1 p-6">{children}</main>
          </div>
        </div>
      </SidebarProvider>
    </OrgContext.Provider>
  );
};

export default AppLayout;
