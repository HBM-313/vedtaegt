import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/components/AppLayout";
import { logAuditEvent } from "@/lib/audit";
import { formatShortDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { MoreHorizontal, UserPlus, AlertTriangle, Clock, Send, Undo2 } from "lucide-react";
import { toast } from "sonner";

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  user_id: string | null;
  joined_at: string | null;
  invited_at: string | null;
}

const roleBadge = (role: string) => {
  switch (role) {
    case "owner": return <Badge className="bg-purple-100 text-purple-800 border-purple-200" variant="outline">Ejer</Badge>;
    case "admin": return <Badge className="bg-blue-100 text-blue-800 border-blue-200" variant="outline">Admin</Badge>;
    default: return <Badge variant="outline" className="bg-muted text-muted-foreground">Medlem</Badge>;
  }
};

const TeamSettings = () => {
  const { orgId, memberId, memberRole, userId } = useOrg();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [removeMember, setRemoveMember] = useState<Member | null>(null);

  // Invite state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);

  // Transfer state
  const [transferEmail, setTransferEmail] = useState("");
  const [transferring, setTransferring] = useState(false);

  const isOwner = memberRole === "owner";
  const isOwnerOrAdmin = memberRole === "owner" || memberRole === "admin";

  const fetchMembers = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const { data } = await supabase
      .from("members")
      .select("id, name, email, role, user_id, joined_at, invited_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true });
    if (data) setMembers(data);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const activeMembers = members.filter((m) => m.user_id !== null || m.joined_at !== null);
  const pendingMembers = members.filter((m) => m.user_id === null && m.joined_at === null && m.invited_at !== null);

  const handleRoleChange = async (member: Member, newRole: string) => {
    await supabase.from("members").update({ role: newRole }).eq("id", member.id);
    await logAuditEvent("member.role_changed", "member", member.id, {
      from: member.role,
      to: newRole,
      email: member.email,
    });
    toast.success(`Rolle ændret til ${newRole === "admin" ? "Admin" : "Medlem"}`);
    fetchMembers();
  };

  const handleRemove = async () => {
    if (!removeMember) return;
    await supabase.from("members").delete().eq("id", removeMember.id);
    await logAuditEvent("member.removed", "member", removeMember.id, {
      email: removeMember.email,
      name: removeMember.name,
    });
    toast.success(`${removeMember.name} er fjernet fra foreningen.`);
    setRemoveMember(null);
    fetchMembers();
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !orgId) return;
    setInviting(true);

    const { data, error } = await supabase.functions.invoke("invite-member", {
      body: { email: inviteEmail.trim(), role: inviteRole, org_id: orgId },
    });

    if (error || data?.error) {
      toast.error(data?.error || "Kunne ikke sende invitation.");
    } else {
      toast.success(`Invitation sendt til ${inviteEmail.trim()}`);
      setInviteEmail("");
      setInviteRole("member");
      fetchMembers();
    }
    setInviting(false);
  };

  const handleRevokeInvite = async (member: Member) => {
    await supabase.from("members").delete().eq("id", member.id);
    await logAuditEvent("member.invite_revoked", "member", member.id, { email: member.email });
    toast.success("Invitation trukket tilbage.");
    fetchMembers();
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

  return (
    <div className="space-y-8 max-w-4xl">
      <h1 className="text-2xl font-semibold text-foreground">Team</h1>

      {/* Active members */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Bestyrelsesmedlemmer</CardTitle>
          <CardDescription>Administrér medlemmer og roller i din forening.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Navn</TableHead>
                  <TableHead className="hidden sm:table-cell">E-mail</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead className="hidden md:table-cell">Tilsluttet</TableHead>
                  {isOwnerOrAdmin && <TableHead className="text-right">Handlinger</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeMembers.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{m.email}</TableCell>
                    <TableCell>{roleBadge(m.role)}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {m.joined_at ? formatShortDate(m.joined_at) : "—"}
                    </TableCell>
                    {isOwnerOrAdmin && (
                      <TableCell className="text-right">
                        {m.id !== memberId && m.role !== "owner" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {isOwner && m.role !== "admin" && (
                                <DropdownMenuItem onClick={() => handleRoleChange(m, "admin")}>
                                  Gør til Admin
                                </DropdownMenuItem>
                              )}
                              {isOwner && m.role === "admin" && (
                                <DropdownMenuItem onClick={() => handleRoleChange(m, "member")}>
                                  Gør til Medlem
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setRemoveMember(m)}
                              >
                                Fjern fra forening
                              </DropdownMenuItem>
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

      {/* Pending invitations */}
      {pendingMembers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Afventende invitationer</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead className="hidden sm:table-cell">Inviteret</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Handling</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingMembers.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.email}</TableCell>
                    <TableCell>{roleBadge(m.role)}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {m.invited_at ? formatShortDate(m.invited_at) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                        <Clock className="h-3 w-3 mr-1" />
                        Afventende
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleRevokeInvite(m)}>
                        <Undo2 className="h-3.5 w-3.5 mr-1" />
                        Træk tilbage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Invite new member */}
      {isOwnerOrAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invitér nyt medlem
            </CardTitle>
            <CardDescription>Send en invitation til et nyt bestyrelsesmedlem.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Label htmlFor="invite-email" className="sr-only">E-mail</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="E-mailadresse"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Medlem</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleInvite} disabled={!inviteEmail.trim() || inviting}>
                <Send className="h-4 w-4 mr-1" />
                {inviting ? "Sender..." : "Send invitation"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ownership transfer - owner only */}
      {isOwner && (
        <>
          <Separator />
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Overdrag ejerskab
              </CardTitle>
              <CardDescription>
                Overdrag ejerskabet af denne forening til et andet bestyrelsesmedlem.
                Du vil automatisk blive degraderet til Admin.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <Input
                    type="email"
                    placeholder="E-mailadresse på ny ejer"
                    value={transferEmail}
                    onChange={(e) => setTransferEmail(e.target.value)}
                  />
                </div>
                <Button
                  variant="destructive"
                  onClick={handleTransfer}
                  disabled={!transferEmail.trim() || transferring}
                >
                  {transferring ? "Sender..." : "Send overdragelsesanmodning"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Remove confirmation */}
      <AlertDialog open={!!removeMember} onOpenChange={(open) => { if (!open) setRemoveMember(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fjern medlem</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på, at du vil fjerne {removeMember?.name} ({removeMember?.email}) fra foreningen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Fjern
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TeamSettings;
