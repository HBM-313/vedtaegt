import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/components/AppLayout";
import { logAuditEvent } from "@/lib/audit";
import { formatShortDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Building2, CreditCard, Shield, Trash2, Download, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Org {
  id: string;
  name: string;
  cvr: string | null;
  plan: string;
  subscription_status: string | null;
  dpa_accepted_at: string | null;
  dpa_version: string | null;
  deletion_requested_at: string | null;
}

interface UsageData {
  meetingsThisYear: number;
  membersCount: number;
  storageMb: number;
}

const PLAN_LIMITS = {
  free: { meetings: 3, members: 5, storageMb: 100 },
};

const planBadge = (plan: string) => {
  switch (plan) {
    case "forening": return <Badge className="bg-blue-100 text-blue-800 border-blue-200" variant="outline">Forening</Badge>;
    case "paraply": return <Badge className="bg-purple-100 text-purple-800 border-purple-200" variant="outline">Paraply</Badge>;
    default: return <Badge variant="outline" className="bg-muted text-muted-foreground">Gratis</Badge>;
  }
};

const OrgSettings = () => {
  const { orgId, memberRole } = useOrg();
  const navigate = useNavigate();
  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Editable fields
  const [name, setName] = useState("");
  const [cvr, setCvr] = useState("");

  // Usage
  const [usage, setUsage] = useState<UsageData>({ meetingsThisYear: 0, membersCount: 0, storageMb: 0 });

  // Delete flow
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const isOwner = memberRole === "owner";

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);

    const [orgRes, meetingsRes, membersRes, docsRes] = await Promise.all([
      supabase.from("organizations").select("*").eq("id", orgId).single(),
      supabase.from("meetings").select("id").eq("org_id", orgId).gte("created_at", `${new Date().getFullYear()}-01-01`),
      supabase.from("members").select("id").eq("org_id", orgId),
      supabase.from("documents").select("file_size_bytes").eq("org_id", orgId),
    ]);

    if (orgRes.data) {
      const o = orgRes.data;
      setOrg(o);
      setName(o.name);
      setCvr(o.cvr || "");
    }

    const totalBytes = docsRes.data?.reduce((sum, d) => sum + (d.file_size_bytes || 0), 0) || 0;
    setUsage({
      meetingsThisYear: meetingsRes.data?.length || 0,
      membersCount: membersRes.data?.length || 0,
      storageMb: Math.round((totalBytes / (1024 * 1024)) * 10) / 10,
    });

    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    const updates: Record<string, string | null> = { name: name.trim() };
    if (cvr.trim()) updates.cvr = cvr.trim();
    else updates.cvr = null;

    const { error } = await supabase.from("organizations").update(updates).eq("id", orgId);
    if (error) {
      toast.error("Kunne ikke gemme ændringer.");
    } else {
      toast.success("Indstillinger gemt.");
    }
    setSaving(false);
  };

  const handleExport = async () => {
    if (!orgId) return;
    setExporting(true);

    const [orgRes, meetingsRes, minutesRes, membersRes, docsRes, actionItemsRes] = await Promise.all([
      supabase.from("organizations").select("*").eq("id", orgId).single(),
      supabase.from("meetings").select("*").eq("org_id", orgId),
      supabase.from("minutes").select("*").eq("org_id", orgId),
      supabase.from("members").select("id, name, email, role, joined_at, invited_at").eq("org_id", orgId),
      supabase.from("documents").select("id, name, category, created_at, file_size_bytes").eq("org_id", orgId),
      supabase.from("action_items").select("*").eq("org_id", orgId),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      organization: orgRes.data,
      meetings: meetingsRes.data || [],
      minutes: minutesRes.data || [],
      members: membersRes.data || [],
      documents: docsRes.data || [],
      action_items: actionItemsRes.data || [],
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `bestyrelsesrum-eksport-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);

    await logAuditEvent("org.data_exported", "organization", orgId);
    toast.success("Data eksporteret.");
    setExporting(false);
  };

  const handleRequestDeletion = async () => {
    if (!orgId || confirmName !== org?.name) return;
    setDeleting(true);

    await supabase.from("organizations").update({ deletion_requested_at: new Date().toISOString() }).eq("id", orgId);
    await logAuditEvent("org.deletion_requested", "organization", orgId);

    toast.success("Sletningsanmodning registreret.");
    setDeleteStep(0);
    setConfirmName("");
    setDeleting(false);
    navigate("/dashboard");
  };

  const usageBar = (current: number, max: number, label: string, unit = "") => {
    const pct = Math.min((current / max) * 100, 100);
    const isHigh = pct >= 80;
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className={`tabular-nums ${isHigh ? "text-destructive font-medium" : "text-foreground"}`}>
            {current}{unit} / {max}{unit}
          </span>
        </div>
        <Progress value={pct} className={`h-2 ${isHigh ? "[&>div]:bg-destructive" : ""}`} />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    );
  }

  const deletionDate = org?.deletion_requested_at
    ? new Date(new Date(org.deletion_requested_at).getTime() + 30 * 24 * 60 * 60 * 1000)
    : null;

  return (
    <div className="space-y-8 max-w-3xl">
      <h1 className="text-2xl font-semibold text-foreground">Foreningsindstillinger</h1>

      {/* Deletion banner */}
      {org?.deletion_requested_at && deletionDate && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-destructive">Sletning anmodet</p>
            <p className="text-sm text-muted-foreground">
              Din forening slettes den {formatShortDate(deletionDate)}.
            </p>
          </div>
        </div>
      )}

      {/* Section 1: Stamoplysninger */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Stamoplysninger
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Foreningens navn</Label>
            <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-cvr">CVR-nummer (valgfrit)</Label>
            <Input
              id="org-cvr"
              value={cvr}
              onChange={(e) => setCvr(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="12345678"
              maxLength={8}
            />
          </div>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? "Gemmer..." : "Gem ændringer"}
          </Button>
        </CardContent>
      </Card>

      {/* Section 2: Abonnement */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Abonnement
          </CardTitle>
          <CardDescription className="flex items-center gap-2">
            Nuværende plan: {planBadge(org?.plan || "free")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {org?.plan === "free" && (
            <>
              <div className="space-y-3">
                {usageBar(usage.meetingsThisYear, PLAN_LIMITS.free.meetings, "Møder dette år")}
                {usageBar(usage.membersCount, PLAN_LIMITS.free.members, "Medlemmer")}
                {usageBar(usage.storageMb, PLAN_LIMITS.free.storageMb, "Storage", " MB")}
              </div>
              <Separator />
              <Button>Opgrader til Forening — 99 kr/md</Button>
            </>
          )}
          {org?.plan !== "free" && (
            <Button variant="outline">Administrér abonnement</Button>
          )}
        </CardContent>
      </Card>

      {/* Section 3: GDPR */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Dine data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {org?.dpa_accepted_at && (
            <p className="text-sm text-muted-foreground">
              Databehandleraftale accepteret: {formatShortDate(org.dpa_accepted_at)}
              {org.dpa_version && ` (version ${org.dpa_version})`}
            </p>
          )}
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="h-4 w-4 mr-1" />
            {exporting ? "Eksporterer..." : "Hent alle data (GDPR-eksport)"}
          </Button>
        </CardContent>
      </Card>

      {/* Section 4: Slet forening */}
      {isOwner && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Slet forening
            </CardTitle>
            <CardDescription>
              Alle data slettes permanent. Denne handling kan ikke fortrydes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={() => setDeleteStep(1)} disabled={!!org?.deletion_requested_at}>
              {org?.deletion_requested_at ? "Sletning allerede anmodet" : "Anmod om sletning"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteStep > 0} onOpenChange={(open) => { if (!open) { setDeleteStep(0); setConfirmName(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {deleteStep === 1 ? "Slet forening" : "Bekræft sletning"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {deleteStep === 1 && (
                  <>
                    <p>Din forening og alle tilknyttede data slettes permanent om 30 dage.</p>
                    <p className="font-medium text-foreground">
                      Bemærk: Regnskabsdokumenter opbevares i 5 år jf. Bogføringsloven, selv efter sletning af foreningen.
                    </p>
                    <p>Du vil modtage en bekræftelses-e-mail.</p>
                  </>
                )}
                {deleteStep === 2 && (
                  <div className="space-y-3">
                    <p>Skriv foreningens navn for at bekræfte: <strong>{org?.name}</strong></p>
                    <Input
                      value={confirmName}
                      onChange={(e) => setConfirmName(e.target.value)}
                      placeholder={org?.name}
                    />
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            {deleteStep === 1 && (
              <AlertDialogAction onClick={(e) => { e.preventDefault(); setDeleteStep(2); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Fortsæt
              </AlertDialogAction>
            )}
            {deleteStep === 2 && (
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); handleRequestDeletion(); }}
                disabled={confirmName !== org?.name || deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? "Sletter..." : "Bekræft sletning"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OrgSettings;
