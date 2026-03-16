import { useEffect, useState, createContext, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  FileText,
  ClipboardCheck,
  FolderOpen,
  Settings,
  LogOut,
  Shield,
} from "lucide-react";
import { toast } from "sonner";

interface OrgContextType {
  orgId: string | null;
  orgName: string | null;
  memberId: string | null;
  memberName: string | null;
  memberRole: string | null;
  userId: string | null;
}

const OrgContext = createContext<OrgContextType>({
  orgId: null,
  orgName: null,
  memberId: null,
  memberName: null,
  memberRole: null,
  userId: null,
});

export const useOrg = () => useContext(OrgContext);

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: BarChart3 },
  { title: "Møder", url: "/moeder", icon: FileText },
  { title: "Handlingspunkter", url: "/handlingspunkter", icon: ClipboardCheck },
  { title: "Dokumenter", url: "/dokumenter", icon: FolderOpen },
  { title: "Indstillinger", url: "/indstillinger", icon: Settings },
];

function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { orgName, memberName } = useOrg();

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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        {!collapsed ? (
          <div className="flex items-center justify-between">
            <span className="text-xs text-sidebar-foreground truncate">
              {memberName || "Bruger"}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={handleLogout}
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 mx-auto"
            onClick={handleLogout}
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const [orgData, setOrgData] = useState<OrgContextType>({
    orgId: null,
    orgName: null,
    memberId: null,
    memberName: null,
    memberRole: null,
    userId: null,
  });

  useEffect(() => {
    const loadOrg = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: member } = await supabase
        .from("members")
        .select("id, org_id, name, role, organizations(name)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (member) {
        const org = member.organizations as unknown as { name: string } | null;
        setOrgData({
          orgId: member.org_id,
          orgName: org?.name ?? null,
          memberId: member.id,
          memberName: member.name,
          memberRole: member.role,
          userId: user.id,
        });
      }
    };
    loadOrg();
  }, []);

  return (
    <OrgContext.Provider value={orgData}>
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
