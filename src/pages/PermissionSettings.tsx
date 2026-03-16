import { useEffect, useState, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrg, type RolePermission } from "@/components/AppLayout";
import { usePermissions } from "@/hooks/usePermissions";
import { logAuditEvent } from "@/lib/audit";
import { getRoleLabel, type DanishRole } from "@/lib/roles";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import SettingsTabs from "@/components/SettingsTabs";
import { Lock, RotateCcw, Info, Save } from "lucide-react";
import { toast } from "sonner";

const ROLE_ORDER: DanishRole[] = ["formand", "naestformand", "kasserer", "bestyrelsesmedlem", "suppleant"];

const ROLE_BADGE_STYLES: Record<string, string> = {
  formand: "bg-blue-900 text-blue-50 border-blue-800",
  naestformand: "bg-blue-100 text-blue-800 border-blue-200",
  kasserer: "bg-green-100 text-green-800 border-green-200",
  bestyrelsesmedlem: "bg-muted text-muted-foreground border-border",
  suppleant: "bg-muted/50 text-muted-foreground/70 border-border italic",
};

type PermKey = keyof Omit<RolePermission, "arver_formand_ved_fravaer">;
type AllPermKey = PermKey | "arver_formand_ved_fravaer";

interface PermField {
  key: AllPermKey;
  label: string;
  category: string;
}

const PERM_FIELDS: PermField[] = [
  { key: "kan_oprette_moeder", label: "Oprette møde", category: "Møder" },
  { key: "kan_redigere_moeder", label: "Redigere møde", category: "Møder" },
  { key: "kan_sende_til_godkendelse", label: "Sende referat til godkendelse", category: "Møder" },
  { key: "kan_godkende_referat", label: "Godkende referat", category: "Møder" },
  { key: "kan_uploade_dokumenter", label: "Uploade dokumenter", category: "Dokumenter" },
  { key: "kan_slette_dokumenter", label: "Slette dokumenter", category: "Dokumenter" },
  { key: "kan_lukke_andres_handlingspunkter", label: "Lukke andres handlingspunkter", category: "Handlingspunkter" },
  { key: "kan_invitere_medlemmer", label: "Invitere medlemmer", category: "Team" },
  { key: "kan_fjerne_medlemmer", label: "Fjerne medlemmer", category: "Team" },
  { key: "kan_aendre_roller", label: "Ændre roller", category: "Indstillinger" },
  { key: "kan_se_indstillinger", label: "Se indstillinger", category: "Indstillinger" },
  { key: "kan_redigere_forening", label: "Redigere foreningsoplysninger", category: "Indstillinger" },
];

const VIKARIAT_FIELD: PermField = {
  key: "arver_formand_ved_fravaer",
  label: "Arver formandens rettigheder ved fravær",
  category: "Vikariat",
};

// Locked TRUE for formand (trigger-enforced)
const LOCKED_FORMAND_KEYS: Set<AllPermKey> = new Set([
  "kan_aendre_roller", "kan_redigere_forening", "kan_slette_dokumenter",
  "kan_invitere_medlemmer", "kan_fjerne_medlemmer", "kan_se_indstillinger",
]);

// Locked TRUE for all roles
const LOCKED_ALL_KEYS: Set<AllPermKey> = new Set(["kan_godkende_referat"]);

type PermState = Record<DanishRole, Record<AllPermKey, boolean>>;

function toPermState(rp: Record<string, RolePermission>): PermState {
  const state = {} as PermState;
  for (const role of ROLE_ORDER) {
    const p = rp[role];
    if (!p) {
      state[role] = {} as Record<AllPermKey, boolean>;
      continue;
    }
    state[role] = {
      kan_oprette_moeder: p.kan_oprette_moeder,
      kan_redigere_moeder: p.kan_redigere_moeder,
      kan_sende_til_godkendelse: p.kan_sende_til_godkendelse,
      kan_godkende_referat: p.kan_godkende_referat,
      kan_uploade_dokumenter: p.kan_uploade_dokumenter,
      kan_slette_dokumenter: p.kan_slette_dokumenter,
      kan_lukke_andres_handlingspunkter: p.kan_lukke_andres_handlingspunkter,
      kan_invitere_medlemmer: p.kan_invitere_medlemmer,
      kan_fjerne_medlemmer: p.kan_fjerne_medlemmer,
      kan_aendre_roller: p.kan_aendre_roller,
      kan_se_indstillinger: p.kan_se_indstillinger,
      kan_redigere_forening: p.kan_redigere_forening,
      arver_formand_ved_fravaer: p.arver_formand_ved_fravaer,
    };
  }
  return state;
}

function deepEqual(a: PermState, b: PermState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const PermissionSettings = () => {
  const { orgId, refetchPermissions, rolePermissions } = useOrg();
  const perms = usePermissions();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);

  const [original, setOriginal] = useState<PermState | null>(null);
  const [pending, setPending] = useState<PermState | null>(null);

  const hasUnsaved = original && pending ? !deepEqual(original, pending) : false;

  // Block navigation with unsaved changes
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    hasUnsaved && currentLocation.pathname !== nextLocation.pathname
  );

  // Load permissions from context or fetch
  const loadPermissions = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
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
      const state = toPermState(map);
      setOriginal(state);
      setPending(state);
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => { loadPermissions(); }, [loadPermissions]);

  if (perms.loaded && !perms.erFormand) {
    toast.error("Du har ikke adgang til denne side.");
    return <Navigate to="/dashboard" replace />;
  }

  const handleToggle = (role: DanishRole, key: AllPermKey) => {
    if (!pending) return;
    setPending((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [role]: { ...prev[role], [key]: !prev[role][key] },
      };
    });
  };

  const isLocked = (role: DanishRole, key: AllPermKey): boolean => {
    if (role === "formand") return true; // entire formand section is locked
    if (LOCKED_ALL_KEYS.has(key)) return true;
    if (key === "arver_formand_ved_fravaer" && role === "naestformand") return true;
    return false;
  };

  const getLockTooltip = (role: DanishRole, key: AllPermKey): string | null => {
    if (role === "formand") return "Formanden har altid alle tilladelser.";
    if (LOCKED_ALL_KEYS.has(key)) return "Alle bestyrelsesmedlemmer har ret til at godkende referater.";
    if (key === "arver_formand_ved_fravaer") return "Næstformanden arver altid formandens rettigheder ved fravær.";
    return null;
  };

  const handleSave = async () => {
    if (!orgId || !pending || !original) return;
    setSaving(true);

    try {
      // Calculate diff and build audit changes
      const changes: { role: string; felt: string; fra: boolean; til: boolean }[] = [];
      const updates: { role: DanishRole; data: Record<string, boolean> }[] = [];

      for (const role of ROLE_ORDER) {
        if (role === "formand") continue; // formand is locked
        const diff: Record<string, boolean> = {};
        let hasDiff = false;
        for (const field of [...PERM_FIELDS, VIKARIAT_FIELD]) {
          const key = field.key;
          if (isLocked(role, key)) continue;
          if (role !== "naestformand" && key === "arver_formand_ved_fravaer") continue;
          if (pending[role][key] !== original[role][key]) {
            diff[key] = pending[role][key];
            changes.push({ role, felt: field.label, fra: original[role][key], til: pending[role][key] });
            hasDiff = true;
          }
        }
        if (hasDiff) updates.push({ role, data: diff });
      }

      if (updates.length === 0) {
        setSaving(false);
        return;
      }

      // Update each changed role
      for (const upd of updates) {
        const { error } = await supabase
          .from("role_permissions")
          .update(upd.data as any)
          .eq("org_id", orgId)
          .eq("role", upd.role);
        if (error) throw error;
      }

      // Increment permission_version
      await supabase.rpc("user_is_org_member", { _org_id: orgId }); // just to verify
      const { data: orgRow } = await supabase
        .from("organizations")
        .select("permission_version")
        .eq("id", orgId)
        .single();
      const currentVersion = (orgRow as any)?.permission_version ?? 1;
      await supabase
        .from("organizations")
        .update({ permission_version: currentVersion + 1 } as any)
        .eq("id", orgId);

      // Log audit
      await logAuditEvent("org.permissions_updated", "organization", orgId, {
        changes: JSON.stringify(changes),
      } as any);

      setOriginal(pending);
      refetchPermissions();
      toast.success("Tilladelser gemt. Ændringerne er nu aktive for alle bestyrelsesmedlemmer.");
    } catch {
      toast.error("Noget gik galt. Tilladelserne blev ikke gemt. Prøv igen eller genindlæs siden.");
    }
    setSaving(false);
  };

  const handleReset = async () => {
    if (!orgId) return;
    setResetting(true);
    try {
      await supabase.rpc("insert_default_permissions", { p_org_id: orgId });

      const { data: orgRow } = await supabase
        .from("organizations")
        .select("permission_version")
        .eq("id", orgId)
        .single();
      const currentVersion = (orgRow as any)?.permission_version ?? 1;
      await supabase
        .from("organizations")
        .update({ permission_version: currentVersion + 1 } as any)
        .eq("id", orgId);

      await logAuditEvent("org.permissions_reset", "organization", orgId);
      await loadPermissions();
      refetchPermissions();
      toast.success("Tilladelser nulstillet til standard.");
    } catch {
      toast.error("Kunne ikke nulstille tilladelser.");
    }
    setResetting(false);
    setShowResetDialog(false);
  };

  const groupedFields = (role: DanishRole) => {
    const fields = [...PERM_FIELDS];
    if (role === "naestformand") fields.push(VIKARIAT_FIELD);
    const groups: Record<string, PermField[]> = {};
    for (const f of fields) {
      if (!groups[f.category]) groups[f.category] = [];
      groups[f.category].push(f);
    }
    return groups;
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <SettingsTabs />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <SettingsTabs />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Rolletilladelser</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tilpas hvad de forskellige roller må i din forening. Ændringer træder i kraft for alle med den pågældende rolle når du trykker Gem.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowResetDialog(true)}
          disabled={resetting}
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          Nulstil til standard
        </Button>
      </div>

      {ROLE_ORDER.map((role) => {
        const groups = groupedFields(role);
        const isFormand = role === "formand";

        return (
          <Card key={role}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Badge variant="outline" className={ROLE_BADGE_STYLES[role]}>
                  {getRoleLabel(role)}
                </Badge>
              </CardTitle>
              {isFormand && (
                <div className="flex items-start gap-2 bg-muted/50 border border-border rounded-md p-3 mt-2">
                  <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Formanden har altid alle tilladelser. Dette kan ikke ændres for at sikre at foreningen altid har én bruger med fuld adgang.
                  </p>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(groups).map(([category, fields], ci) => (
                <div key={category}>
                  {ci > 0 && <Separator className="mb-4" />}
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    {category}
                  </p>
                  <div className="space-y-3">
                    {fields.map((field) => {
                      const locked = isLocked(role, field.key);
                      const checked = pending?.[role]?.[field.key] ?? false;
                      const lockTip = getLockTooltip(role, field.key);

                      return (
                        <div key={field.key} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-foreground">{field.label}</span>
                            {locked && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs text-xs">{lockTip}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          <Switch
                            checked={locked ? true : checked}
                            disabled={locked}
                            onCheckedChange={() => handleToggle(role, field.key)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      <div className="flex justify-end sticky bottom-4">
        <Button
          onClick={handleSave}
          disabled={!hasUnsaved || saving}
          size="lg"
          className={hasUnsaved ? "shadow-lg" : ""}
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Gemmer..." : "Gem tilladelser"}
        </Button>
      </div>

      {/* Reset confirmation */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nulstil tilladelser</AlertDialogTitle>
            <AlertDialogDescription>
              Dette nulstiller ALLE rollers tilladelser til Vedtægts standardindstillinger. Dine tilpasninger slettes. Er du sikker?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annullér</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleReset(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={resetting}
            >
              {resetting ? "Nulstiller..." : "Ja, nulstil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsaved changes navigation blocker */}
      <AlertDialog open={blocker.state === "blocked"} onOpenChange={(open) => { if (!open) blocker.reset?.(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ugemte ændringer</AlertDialogTitle>
            <AlertDialogDescription>
              Du har ugemte ændringer i rolletilladelser. Vil du gemme inden du forlader siden?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => blocker.reset?.()}>Bliv på siden</AlertDialogCancel>
            <Button variant="outline" onClick={() => blocker.proceed?.()}>Forlad uden at gemme</Button>
            <Button onClick={async () => { await handleSave(); blocker.proceed?.(); }}>Gem og forlad</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PermissionSettings;
