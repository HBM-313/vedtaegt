import { useEffect, useState, useRef, createContext, useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import {
  BarChart3, FileText, ClipboardCheck, FolderOpen, Settings, LogOut, Shield, User,
} from "lucide-react";
import { toast } from "sonner";

export interface RolePermission {
  kan_oprette_moeder: boolean;
  kan_redigere_moeder: boolean;
  kan_sende_til_godkendelse: boolean;
  kan_godkende_referat: boolean;
  kan_se_dokumenter: boolean;
  kan_uploade_dokumenter: boolean;
  kan_slette_dokumenter: boolean;
  kan_lukke_andres_handlingspunkter: boolean;
  kan_invitere_medlemmer: boolean;
  kan_fjerne_medlemmer: boolean;
  kan_aendre_roller: boolean;
  kan_se_indstillinger: boolean;
  kan_redigere_forening: boolean;
  arver_formand_ved_fravaer: boolean;
}

export interface OrgMember {
  id: string;
  role: string;
  er_fravaerende: boolean;
  name: string;
}

interface OrgContextType {
  orgId: string | null;
  orgName: string | null;
  memberId: string | null;
  memberName: string | null;
  memberRole: string | null;
  userId: string | null;
  rolePermissions: Record<string, RolePermission> | null;
  members: OrgMember[] | null;
  refetchPermissions: () => void;
}

const OrgContext = createContext<OrgContextType>({
  orgId: null, orgName: null, memberId: null, memberName: null,
  memberRole: null, userId: null, rolePermissions: null, members: null,
  refetchPermissions: () => {},
});

export const useOrg = () => useContext(OrgContext);

function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { orgName, memberName, rolePermissions, memberRole } = useOrg();

  const kanSeIndstillinger = rolePermissions && memberRole
    ? rolePermissions[memberRole]?.kan_se_indstillinger ?? false
    : false;

  const navItems = [
    { title: "Dashboard", url: "/dashboard", icon: BarChart3 },
    { title: "Møder", url: "/moeder", icon: FileText },
    { title: "Handlingspunkter", url: "/handlingspunkter", icon: ClipboardCheck },
    { title: "Dokumenter", url: "/dokumenter", icon: FolderOpen },
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
                    <NavLink to={item.url} className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {kanSeIndstillinger && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/indstillinger" className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
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
            <NavLink to="/profil" className="flex items-center gap-2 text-xs text-sidebar-foreground hover:text-sidebar-primary transition-colors" activeClassName="text-sidebar-primary font-medium">
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

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const navigate = useNavigate();
  const [orgData, setOrgData] = useState<OrgContextType>({
    orgId: null, orgName: null, memberId: null, memberName: null,
    memberRole: null, userId: null, rolePermissions: null, members: null,
    refetchPermissions: () => {},
  });
  const [contextError, setContextError] = useState<string | null>(null);
  const permVersionRef = useRef<number | null>(null);

  const fetchPermissions = useCallback(async (orgId: string) => {
    const { data } = await supabase
      .from("role_permissions")
      .select("*")
      .eq("org_id", orgId);

    if (data) {
      const map: Record<string, RolePermission> = {};
      data.forEach((row: any) => {
        map[row.role] = {
          kan_oprette_moeder: row.kan_oprette_moeder,
          kan_redigere_moeder: row.kan_redigere_moeder,
          kan_sende_til_godkendelse: row.kan_sende_til_godkendelse,
          kan_godkende_referat: row.kan_godkende_referat,
          kan_uploade_dokumenter: row.kan_uploade_dokumenter,
          kan_slette_dokumenter: row.kan_slette_dokumenter,
          kan_lukke_andres_handlingspunkter: row.kan_lukke_andres_handlingspunkter,
          kan_invitere_medlemmer: row.kan_invitere_medlemmer,
          kan_fjerne_medlemmer: row.kan_fjerne_medlemmer,
          kan_aendre_roller: row.kan_aendre_roller,
          kan_se_indstillinger: row.kan_se_indstillinger,
          kan_redigere_forening: row.kan_redigere_forening,
          arver_formand_ved_fravaer: row.arver_formand_ved_fravaer,
        };
      });
      return map;
    }
    return null;
  }, []);

  const fetchMembers = useCallback(async (orgId: string): Promise<OrgMember[]> => {
    const { data } = await supabase
      .from("members")
      .select("id, role, name, er_fravaerende")
      .eq("org_id", orgId);
    return (data as any[]) || [];
  }, []);

  useEffect(() => {
    const loadOrg = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Handle pending signup
      const pendingRaw = localStorage.getItem("vedtaegt_pending_signup");
      if (pendingRaw) {
        try {
          const pending = JSON.parse(pendingRaw);
          if (pending.userId === user.id || pending.email === user.email) {
            const { data: existingMember } = await supabase
              .from("members").select("id").eq("user_id", user.id).maybeSingle();

            if (!existingMember) {
              const { data: org, error: orgError } = await supabase
                .from("organizations")
                .insert({
                  name: pending.orgName, cvr: pending.cvr, plan: "free",
                  dpa_accepted_at: new Date().toISOString(), dpa_version: "1.0",
                  adresse: pending.orgAdresse || null,
                  postnummer: pending.orgPostnummer || null,
                  by: pending.orgBy || null,
                  telefon: pending.orgTelefon || null,
                  kontakt_email: pending.orgEmail || null,
                } as any)
                .select().single();

              if (!orgError && org) {
                await supabase.rpc("insert_default_permissions", { p_org_id: org.id });
                const now = new Date().toISOString();
                await supabase.from("members").insert({
                  org_id: org.id, user_id: user.id, role: "formand",
                  name: pending.name, email: pending.email || user.email,
                  joined_at: now, marketing_consent: pending.marketingConsent || false,
                  marketing_consent_at: pending.marketingConsent ? now : null,
                  telefon: pending.telefon || null,
                  adresse: pending.adresse || null,
                  postnummer: pending.postnummer || null,
                  by: pending.by || null,
                  foedselsdato: pending.foedselsdato || null,
                  email_bekraeftet: true,
                } as any);
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
        const orgId = member.org_id!;
        const [rolePerms, orgMembers] = await Promise.all([
          fetchPermissions(orgId),
          fetchMembers(orgId),
        ]);

        // Get initial permission_version
        const { data: orgRow } = await supabase
          .from("organizations").select("permission_version").eq("id", orgId).single();
        permVersionRef.current = (orgRow as any)?.permission_version ?? 1;

        setOrgData({
          orgId, orgName: org?.name ?? null,
          memberId: member.id, memberName: member.name,
          memberRole: member.role, userId: user.id,
          rolePermissions: rolePerms, members: orgMembers,
          refetchPermissions: () => {},
        });
      } else {
        setContextError("Din brugerprofil kunne ikke findes. Prøv at logge ud og ind igen.");
      }
    };
    loadOrg();
  }, [fetchPermissions, fetchMembers]);

  // Poll permission_version every 60s
  useEffect(() => {
    if (!orgData.orgId) return;
    const orgId = orgData.orgId;

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("organizations").select("permission_version").eq("id", orgId).single();
      const newVersion = (data as any)?.permission_version ?? 1;

      if (permVersionRef.current !== null && newVersion !== permVersionRef.current) {
        permVersionRef.current = newVersion;
        const [rolePerms, orgMembers] = await Promise.all([
          fetchPermissions(orgId),
          fetchMembers(orgId),
        ]);
        toast.info("Dine tilladelser er blevet opdateret af formanden.");
        setOrgData((prev) => ({ ...prev, rolePermissions: rolePerms, members: orgMembers }));
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, [orgData.orgId, fetchPermissions, fetchMembers]);

  // Expose refetchPermissions
  const refetchPermissions = useCallback(async () => {
    if (!orgData.orgId) return;
    const [rolePerms, orgMembers] = await Promise.all([
      fetchPermissions(orgData.orgId),
      fetchMembers(orgData.orgId),
    ]);
    setOrgData((prev) => ({ ...prev, rolePermissions: rolePerms, members: orgMembers }));
  }, [orgData.orgId, fetchPermissions, fetchMembers]);

  const contextValue = { ...orgData, refetchPermissions };

  if (contextError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-sm">
          <Shield className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">{contextError}</p>
          <Button size="sm" variant="outline" onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}>
            <LogOut className="h-4 w-4 mr-1" /> Log ud
          </Button>
        </div>
      </div>
    );
  }

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
