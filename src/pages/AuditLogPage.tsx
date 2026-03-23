import { useEffect, useState, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/context/OrgContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import SettingsTabs from "@/components/SettingsTabs";
import { Search, X } from "lucide-react";
import { getRoleLabel } from "@/lib/roles";

interface AuditEvent {
  id: string;
  action: string;
  resource_type: string | null;
  created_at: string;
  user_name: string | null;
  metadata: Record<string, unknown> | null;
}

const ACTION_LABELS: Record<string, string> = {
  "meeting.created": "Møde oprettet",
  "meeting.status_changed": "Møde-status ændret",
  "meeting.sent_for_approval": "Sendt til godkendelse",
  "meeting.referat_godkendt": "Referat godkendt",
  "meeting.referat_afvist": "Referat afvist",
  "meeting.fully_approved": "Fuldt godkendt",
  "meeting.paamindelse_sendt": "Påmindelse sendt",
  "meeting.indkaldelse_sendt": "GF-indkaldelse sendt",
  "action_item.completed": "Handlingspunkt lukket",
  "document.uploaded": "Dokument uploadet",
  "document.deleted": "Dokument slettet",
  "document.category_changed": "Dokumentkategori ændret",
  "document_category.created": "Kategori oprettet",
  "document_category.deleted": "Kategori slettet",
  "member.invite_revoked": "Invitation tilbagekaldt",
  "member.removed": "Medlem fjernet",
  "member.role_changed": "Rolle ændret",
  "member.profile_updated": "Profil opdateret",
  "org.data_exported": "Data eksporteret",
  "org.deletion_requested": "Sletning anmodet",
  "org.ownership_transferred": "Ejerskab overdraget",
  "org.permissions_reset": "Tilladelser nulstillet",
  "org.permissions_updated": "Tilladelser opdateret",
  "vedtaegt.version_oprettet": "Vedtægt uploadet",
  "vedtaegt.version_slettet": "Vedtægt slettet",
  "vedtaegt.gaeldende_sat": "Gældende vedtægt sat",
};

const RESOURCE_COLOR: Record<string, string> = {
  meeting: "bg-blue-100 text-blue-800 border-transparent dark:bg-blue-900/30 dark:text-blue-400",
  document: "bg-orange-100 text-orange-800 border-transparent dark:bg-orange-900/30 dark:text-orange-400",
  action_item: "bg-green-100 text-green-800 border-transparent dark:bg-green-900/30 dark:text-green-400",
  member: "bg-purple-100 text-purple-800 border-transparent dark:bg-purple-900/30 dark:text-purple-400",
  organization: "bg-muted text-muted-foreground border-transparent",
  vedtaegt_version: "bg-violet-100 text-violet-800 border-transparent dark:bg-violet-900/30 dark:text-violet-400",
};

const formatDanishDateTime = (iso: string) =>
  new Intl.DateTimeFormat("da-DK", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));

const AuditLogPage = () => {
  const { orgId } = useOrg();
  const perms = usePermissions();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const { data } = await supabase
      .from("audit_events")
      .select("id, action, resource_type, created_at, user_id, metadata")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (!data) { setLoading(false); return; }

    // Hent brugernavne for alle unikke user_ids
    const userIds = [...new Set(data.map((e) => e.user_id).filter(Boolean))] as string[];
    const memberMapResult = userIds.length > 0
      ? await supabase.from("members").select("user_id, name").eq("org_id", orgId).in("user_id", userIds)
      : { data: [] };
    const memberMap: Record<string, string> = Object.fromEntries(
      (memberMapResult.data ?? [])
        .filter((m) => m.user_id)
        .map((m) => [m.user_id!, m.name])
    );

    setEvents(
      data.map((e) => ({
        id: e.id,
        action: e.action,
        resource_type: e.resource_type,
        created_at: e.created_at,
        user_name: e.user_id ? (memberMap[e.user_id] ?? "Ukendt") : "System",
        metadata: e.metadata as Record<string, unknown> | null,
      }))
    );
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  if (perms.loaded && !perms.erFormand) {
    return <Navigate to="/indstillinger" replace />;
  }

  const filtered = search.trim()
    ? events.filter(
        (e) =>
          (ACTION_LABELS[e.action] ?? e.action).toLowerCase().includes(search.toLowerCase()) ||
          e.user_name?.toLowerCase().includes(search.toLowerCase()) ||
          JSON.stringify(e.metadata ?? {}).toLowerCase().includes(search.toLowerCase())
      )
    : events;

  return (
    <div className="space-y-6 max-w-3xl">
      <SettingsTabs />
      <h1 className="text-2xl font-semibold text-foreground">Aktivitetslog</h1>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Søg i log..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-9"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {search ? `Ingen hændelser matcher "${search}".` : "Ingen hændelser endnu."}
        </p>
      ) : (
        <div className="ring-1 ring-border rounded-sm divide-y divide-border overflow-hidden">
          {filtered.map((e) => (
            <div key={e.id} className="flex items-start gap-3 p-3 hover:bg-muted/20 transition-colors">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">
                    {ACTION_LABELS[e.action] ?? e.action}
                  </span>
                  {e.resource_type && (
                    <Badge
                      variant="outline"
                      className={`text-xs ${RESOURCE_COLOR[e.resource_type] ?? RESOURCE_COLOR.organization}`}
                    >
                      {e.resource_type.replace("_", " ")}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {e.user_name}
                  {e.metadata && Object.keys(e.metadata).length > 0 && (
                    <span className="ml-2 opacity-60">
                      {(() => {
                        const m = e.metadata!;
                        // Brugervenlig visning baseret på hændelsestype
                        if (e.action === "member.invite_revoked") {
                          const role = m.role ? getRoleLabel(String(m.role)) : null;
                          return [role, m.email].filter(Boolean).join(" — ");
                        }
                        if (e.action === "member.role_changed") {
                          const from = m.from ? getRoleLabel(String(m.from)) : null;
                          const to = m.to ? getRoleLabel(String(m.to)) : null;
                          return from && to ? `${from} → ${to}` : String(m.email ?? "");
                        }
                        if (e.action === "member.removed") {
                          return String(m.name ?? m.email ?? "");
                        }
                        // Generisk fallback
                        return Object.entries(m)
                          .filter(([k]) => !["resource_id"].includes(k))
                          .map(([, v]) => String(v))
                          .slice(0, 2)
                          .join(" · ");
                      })()}
                    </span>
                  )}
                </p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                {formatDanishDateTime(e.created_at)}
              </span>
            </div>
          ))}
          {!search && (
            <p className="text-xs text-muted-foreground p-3 text-center">
              Viser de seneste 200 hændelser
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default AuditLogPage;
