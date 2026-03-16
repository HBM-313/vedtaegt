import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/components/AppLayout";
import { usePermissions } from "@/hooks/usePermissions";
import { logAuditEvent } from "@/lib/audit";
import { formatShortDate } from "@/lib/format";
import { getRoleLabel, INVITABLE_ROLES, ROLE_SORT_ORDER, type DanishRole } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import SettingsTabs from "@/components/SettingsTabs";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MoreHorizontal, UserPlus, AlertTriangle, Clock, Send, Undo2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

interface Member {
  id: string; name: string; email: string; role: string;
  user_id: string | null; joined_at: string | null; invited_at: string | null;
  er_fravaerende?: boolean; fravaerende_siden?: string | null;
  telefon?: string | null; adresse?: string | null; postnummer?: string | null;
  by?: string | null; foedselsdato?: string | null; email_bekraeftet?: boolean;
}

const ROLE_BADGE_STYLES: Record<string, string> = {
  formand: "bg-blue-900 text-blue-50 border-blue-800",
  naestformand: "bg-blue-100 text-blue-800 border-blue-200",
  kasserer: "bg-green-100 text-green-800 border-green-200",
  bestyrelsesmedlem: "bg-muted text-muted-foreground border-border",
  suppleant: "bg-muted/50 text-muted-foreground/70 border-border italic",
};

const roleBadge = (role: string) => (
  <Badge variant="outline" className={ROLE_BADGE_STYLES[role] || ROLE_BADGE_STYLES.bestyrelsesmedlem}>
    {getRoleLabel(role)}
  </Badge>
);

const TeamSettings = () => {
  const { orgId, memberId, refetchPermissions } = useOrg();
  const perms = usePermissions();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [removeMember, setRemoveMember] = useState<Member | null>(null);
  const [orgLimits, setOrgLimits] = useState({ max_bestyrelsesmedlemmer: 5, max_suppleanter: 2 });

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("bestyrelsesmedlem");
  const [inviting, setInviting] = useState(false);
  const [transferEmail, setTransferEmail] = useState("");
  const [transferring, setTransferring] = useState(false);

  const fetchMembers = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const [membersRes, orgRes] = await Promise.all([
      supabase.from("members")
        .select("id, name, email, role, user_id, joined_at, invited_at, er_fravaerende, fravaerende_siden")
        .eq("org_id", orgId).order("created_at", { ascending: true }),
      supabase.from("organizations")
        .select("max_bestyrelsesmedlemmer, max_suppleanter")
        .eq("id", orgId).maybeSingle(),
    ]);
    if (membersRes.data) {
      const sorted = [...(membersRes.data as Member[])].sort(
        (a, b) => (ROLE_SORT_ORDER[a.role as DanishRole] ?? 99) - (ROLE_SORT_ORDER[b.role as DanishRole] ?? 99)
      );
      setMembers(sorted);
    }
    if (orgRes.data) {
      setOrgLimits({
        max_bestyrelsesmedlemmer: (orgRes.data as any).max_bestyrelsesmedlemmer ?? 5,
        max_suppleanter: (orgRes.data as any).max_suppleanter ?? 2,
      });
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const activeMembers = members.filter((m) => m.user_id !== null || m.joined_at !== null);
  const pendingMembers = members.filter((m) => m.user_id === null && m.joined_at === null && m.invited_at !== null);

  const roleCounts = members.reduce<Record<string, number>>((acc, m) => {
    acc[m.role] = (acc[m.role] || 0) + 1; return acc;
  }, {});

  const handleRoleChange = async (member: Member, newRole: string) => {
    if (!perms.kanAendreRoller) { toast.error("Du har ikke tilladelse til at ændre roller."); return; }
    await supabase.from("members").update({ role: newRole }).eq("id", member.id);
    await logAuditEvent("member.role_changed", "member", member.id, { from: member.role, to: newRole, email: member.email });
    toast.success(`Rolle ændret til ${getRoleLabel(newRole)}`);
    fetchMembers();
  };

  const handleRemove = async () => {
    if (!removeMember) return;
    if (!perms.kanFjerneMedlemmer) { toast.error("Du har ikke tilladelse til at fjerne medlemmer."); setRemoveMember(null); return; }
    await supabase.from("members").delete().eq("id", removeMember.id);
    await logAuditEvent("member.removed", "member", removeMember.id, { email: removeMember.email, name: removeMember.name });
    toast.success(`${removeMember.name} er fjernet fra foreningen.`);
    setRemoveMember(null); fetchMembers();
  };

  const validateInviteRole = (role: string): string | null => {
    if (role === "naestformand" && (roleCounts["naestformand"] || 0) >= 1) return "Foreningen har allerede en næstformand.";
    if (role === "kasserer" && (roleCounts["kasserer"] || 0) >= 1) return "Foreningen har allerede en kasserer.";
    if (role === "bestyrelsesmedlem" && (roleCounts["bestyrelsesmedlem"] || 0) >= orgLimits.max_bestyrelsesmedlemmer)
      return `Maks. antal bestyrelsesmedlemmer er nået (${orgLimits.max_bestyrelsesmedlemmer}). Øg grænsen under Indstillinger → Bestyrelsesstruktur.`;
    if (role === "suppleant" && (roleCounts["suppleant"] || 0) >= orgLimits.max_suppleanter)
      return `Maks. antal suppleanter er nået (${orgLimits.max_suppleanter}).`;
    return null;
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !orgId) return;
    if (!perms.kanInvitereMedlemmer) { toast.error("Du har ikke tilladelse til at invitere medlemmer."); return; }
    const validationError = validateInviteRole(inviteRole);
    if (validationError) { toast.error(validationError); return; }

    setInviting(true);
    const { data, error } = await supabase.functions.invoke("invite-member", {
      body: { email: inviteEmail.trim(), role: inviteRole, org_id: orgId },
    });
    if (error || data?.error) {
      toast.error(data?.error || "Kunne ikke sende invitation.");
    } else {
      toast.success(`Invitation sendt til ${inviteEmail.trim()}`);
      setInviteEmail(""); setInviteRole("bestyrelsesmedlem"); fetchMembers();
    }
    setInviting(false);
  };

  const handleRevokeInvite = async (member: Member) => {
    await supabase.from("members").delete().eq("id", member.id);
    await logAuditEvent("member.invite_revoked", "member", member.id, { email: member.email });
    toast.success("Invitation trukket tilbage."); fetchMembers();
  };

  const handleTransfer = async () => {
    if (!transferEmail.trim() || !orgId) return;
    setTransferring(true);
    const { data, error } = await supabase.functions.invoke("transfer-ownership", {
      body: { to_email: transferEmail.trim(), org_id: orgId },
    });
    if (error || data?.error) {
      toast.error(data?.error || "Kunne ikke sende overdragelsesanmodning.");
    } else {
      toast.success("Anmodning sendt. Linket udløber om 48 timer.");
      setTransferEmail("");
    }
    setTransferring(false);
  };

  const handleToggleAbsence = async (member: Member) => {
    const newAbsent = !member.er_fravaerende;
    await supabase.from("members").update({
      er_fravaerende: newAbsent,
      fravaerende_siden: newAbsent ? new Date().toISOString() : null,
    } as any).eq("id", member.id);

    await logAuditEvent(
      newAbsent ? "member.marked_absent" : "member.marked_present",
      "member", member.id, { member_id: member.id, rolle: member.role }
    );

    toast.success(newAbsent ? `${member.name} er markeret som fraværende.` : `${member.name} er markeret som tilstede.`);
    fetchMembers();
    refetchPermissions();
  };

  const formand = members.find((m) => m.role === "formand");
  const formandAbsent = formand?.er_fravaerende ?? false;

  const summary = [
    `1 formand`,
    roleCounts["naestformand"] ? `1 næstformand` : null,
    roleCounts["kasserer"] ? `1 kasserer` : null,
    `${roleCounts["bestyrelsesmedlem"] || 0}/${orgLimits.max_bestyrelsesmedlemmer} bestyrelsesmedlemmer`,
    `${roleCounts["suppleant"] || 0}/${orgLimits.max_suppleanter} suppleanter`,
  ].filter(Boolean).join(", ");

  return (
    <div className="space-y-8 max-w-4xl">
      <SettingsTabs />
      <h1 className="text-2xl font-semibold text-foreground">Team</h1>
      <p className="text-sm text-muted-foreground">Bestyrelsen består af: {summary}</p>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Bestyrelsesmedlemmer</CardTitle>
          <CardDescription>Administrér medlemmer og roller i din forening.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Navn</TableHead>
                  <TableHead className="hidden sm:table-cell">E-mail</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead className="hidden md:table-cell">Tilsluttet</TableHead>
                  {perms.erFormand && <TableHead className="hidden md:table-cell">Fravær</TableHead>}
                  {(perms.kanAendreRoller || perms.kanFjerneMedlemmer) && <TableHead className="text-right">Handlinger</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeMembers.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {m.name}
                        {m.role === "naestformand" && formandAbsent && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                            <ShieldAlert className="h-3 w-3 mr-1" />
                            Vikarierer{m.er_fravaerende ? "" : ` siden ${formand?.fravaerende_siden ? formatShortDate(formand.fravaerende_siden) : "—"}`}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{m.email}</TableCell>
                    <TableCell>{roleBadge(m.role)}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{m.joined_at ? formatShortDate(m.joined_at) : "—"}</TableCell>
                    {perms.erFormand && (
                      <TableCell className="hidden md:table-cell">
                        {m.id !== memberId && (
                          <Switch
                            checked={m.er_fravaerende ?? false}
                            onCheckedChange={() => handleToggleAbsence(m)}
                          />
                        )}
                      </TableCell>
                    )}
                    {(perms.kanAendreRoller || perms.kanFjerneMedlemmer) && (
                      <TableCell className="text-right">
                        {m.id !== memberId && m.role !== "formand" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {perms.kanAendreRoller && INVITABLE_ROLES.map((r) => (
                                r !== m.role && (
                                  <DropdownMenuItem key={r} onClick={() => handleRoleChange(m, r)}>
                                    Gør til {getRoleLabel(r)}
                                  </DropdownMenuItem>
                                )
                              ))}
                              {perms.kanFjerneMedlemmer && (
                                <DropdownMenuItem className="text-destructive" onClick={() => setRemoveMember(m)}>
                                  Fjern fra forening
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {pendingMembers.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Afventende invitationer</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead><TableHead>Rolle</TableHead>
                  <TableHead className="hidden sm:table-cell">Inviteret</TableHead>
                  <TableHead>Status</TableHead><TableHead className="text-right">Handling</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingMembers.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.email}</TableCell>
                    <TableCell>{roleBadge(m.role)}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{m.invited_at ? formatShortDate(m.invited_at) : "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                        <Clock className="h-3 w-3 mr-1" /> Afventende
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleRevokeInvite(m)}>
                        <Undo2 className="h-3.5 w-3.5 mr-1" /> Træk tilbage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {perms.kanInvitereMedlemmer && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><UserPlus className="h-5 w-5" /> Invitér nyt medlem</CardTitle>
            <CardDescription>Send en invitation til et nyt bestyrelsesmedlem.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Label htmlFor="invite-email" className="sr-only">E-mail</Label>
                <Input id="invite-email" type="email" placeholder="E-mailadresse" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
              </div>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INVITABLE_ROLES.map((r) => <SelectItem key={r} value={r}>{getRoleLabel(r)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={handleInvite} disabled={!inviteEmail.trim() || inviting}>
                <Send className="h-4 w-4 mr-1" /> {inviting ? "Sender..." : "Send invitation"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {perms.erFormand && (
        <>
          <Separator />
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" /> Overdrag formandsposten
              </CardTitle>
              <CardDescription>Overdrag formandsrollen til et andet bestyrelsesmedlem. Du vil automatisk blive bestyrelsesmedlem.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <Input type="email" placeholder="E-mailadresse på ny formand" value={transferEmail} onChange={(e) => setTransferEmail(e.target.value)} />
                </div>
                <Button variant="destructive" onClick={handleTransfer} disabled={!transferEmail.trim() || transferring}>
                  {transferring ? "Sender..." : "Send overdragelsesanmodning"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <AlertDialog open={!!removeMember} onOpenChange={(open) => { if (!open) setRemoveMember(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fjern medlem</AlertDialogTitle>
            <AlertDialogDescription>Er du sikker på, at du vil fjerne {removeMember?.name} ({removeMember?.email}) fra foreningen?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Fjern</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TeamSettings;
