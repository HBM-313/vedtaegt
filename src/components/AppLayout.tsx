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
  const navigate = useNavigate();
  const [orgData, setOrgData] = useState<OrgContextType>({
    orgId: null,
    orgName: null,
    memberId: null,
    memberName: null,
    memberRole: null,
    userId: null,
  });
  const [contextError, setContextError] = useState<string | null>(null);

  useEffect(() => {
    const loadOrg = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Check if there's pending signup data to finalize
      const pendingRaw = localStorage.getItem("vedtaegt_pending_signup");
      if (pendingRaw) {
        try {
          const pending = JSON.parse(pendingRaw);
          // Only process if it matches the current user
          if (pending.userId === user.id || pending.email === user.email) {
            console.log("Completing pending signup for user:", user.id);

            // Check if org+member already exist
            const { data: existingMember } = await supabase
              .from("members")
              .select("id")
              .eq("user_id", user.id)
              .maybeSingle();

            if (!existingMember) {
              // Create organization
              const { data: org, error: orgError } = await supabase
                .from("organizations")
                .insert({
                  name: pending.orgName,
                  cvr: pending.cvr,
                  plan: "free",
                  dpa_accepted_at: new Date().toISOString(),
                  dpa_version: "1.0",
                })
                .select()
                .single();

              if (orgError) {
                console.error("Failed to create org from pending signup:", orgError);
              } else {
                // Create member
                const now = new Date().toISOString();
                const { error: memberError } = await supabase
                  .from("members")
                  .insert({
                    org_id: org.id,
                    user_id: user.id,
                    role: "formand",
                    name: pending.name,
                    email: pending.email || user.email,
                    joined_at: now,
                    marketing_consent: pending.marketingConsent || false,
                    marketing_consent_at: pending.marketingConsent ? now : null,
                  });

                if (memberError) {
                  console.error("Failed to create member from pending signup:", memberError);
                } else {
                  console.log("Pending signup completed successfully");
                }
              }
            }
            localStorage.removeItem("vedtaegt_pending_signup");
          }
        } catch (err) {
          console.error("Error processing pending signup:", err);
          localStorage.removeItem("vedtaegt_pending_signup");
        }
      }

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
      } else {
        console.error("No member row found for user:", user.id);
        setContextError("Din brugerprofil kunne ikke findes. Prøv at logge ud og ind igen.");
      }
    };
    loadOrg();
  }, []);

  if (contextError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-sm">
          <Shield className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">{contextError}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/login";
            }}
          >
            <LogOut className="h-4 w-4 mr-1" />
            Log ud
          </Button>
        </div>
      </div>
    );
  }

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
