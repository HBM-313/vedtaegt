import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, MeetingTypeBadge } from "@/components/StatusBadge";
import { useOrg } from "@/context/OrgContext";
import { formatShortDate } from "@/lib/format";
import { usePermissions } from "@/hooks/usePermissions";
import { Plus, FileText, ClipboardCheck, FolderOpen, AlertTriangle, Clock } from "lucide-react";

interface Meeting {
  id: string;
  title: string;
  meeting_date: string | null;
  status: string | null;
  meeting_type: string | null;
}

interface ActionItem {
  id: string;
  title: string;
  due_date: string | null;
  meeting_id: string | null;
  meetings: { title: string } | null;
}

interface Document {
  id: string;
  name: string;
  category: string | null;
  created_at: string | null;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { orgId, memberId } = useOrg();
  const perms = usePermissions();
  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([]);
  const [pendingMeetings, setPendingMeetings] = useState<Meeting[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [overdueActions, setOverdueActions] = useState<ActionItem[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletionDate, setDeletionDate] = useState<Date | null>(null);

  useEffect(() => {
    if (!orgId) return;

    const load = async () => {
      setLoading(true);
      const now = new Date().toISOString();
      const today = new Date().toISOString().split("T")[0];

      const { data: orgData } = await supabase
        .from("organizations")
        .select("deletion_requested_at")
        .eq("id", orgId)
        .single();
      if (orgData?.deletion_requested_at) {
        setDeletionDate(new Date(new Date(orgData.deletion_requested_at).getTime() + 30 * 24 * 60 * 60 * 1000));
      }

      const [upcomingRes, pendingRes, actionsRes, overdueRes, docsRes] = await Promise.all([
        // Kommende møder (frem i tid)
        supabase
          .from("meetings")
          .select("id, title, meeting_date, status, meeting_type")
          .eq("org_id", orgId)
          .gte("meeting_date", now)
          .not("status", "eq", "approved")
          .order("meeting_date", { ascending: true })
          .limit(3),

        // Møder der afventer godkendelse
        supabase
          .from("meetings")
          .select("id, title, meeting_date, status, meeting_type")
          .eq("org_id", orgId)
          .eq("status", "pending_approval")
          .order("meeting_date", { ascending: false })
          .limit(3),

        // Mine åbne handlingspunkter (ikke forfaldne)
        memberId
          ? supabase
              .from("action_items")
              .select("id, title, due_date, meeting_id, meetings(title)")
              .eq("org_id", orgId)
              .eq("assigned_to", memberId)
              .eq("status", "open")
              .or(`due_date.is.null,due_date.gte.${today}`)
              .order("due_date", { ascending: true })
              .limit(5)
          : Promise.resolve({ data: [] }),

        // Mine forfaldne handlingspunkter
        memberId
          ? supabase
              .from("action_items")
              .select("id, title, due_date, meeting_id, meetings(title)")
              .eq("org_id", orgId)
              .eq("assigned_to", memberId)
              .eq("status", "open")
              .lt("due_date", today)
              .order("due_date", { ascending: true })
              .limit(5)
          : Promise.resolve({ data: [] }),

        // Seneste dokumenter
        supabase
          .from("documents")
          .select("id, name, category, created_at")
          .eq("org_id", orgId)
          .neq("kilde", "vedtaegt")
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

      setUpcomingMeetings((upcomingRes.data as Meeting[]) || []);
      setPendingMeetings((pendingRes.data as Meeting[]) || []);
      setActions((actionsRes.data as ActionItem[]) || []);
      setOverdueActions((overdueRes.data as ActionItem[]) || []);
      setDocuments((docsRes.data as Document[]) || []);
      setLoading(false);
    };

    load();
  }, [orgId, memberId]);

  const Section = ({
    title, icon: Icon, badge, badgeColor = "destructive", children,
  }: {
    title: string;
    icon: React.ElementType;
    badge?: number;
    badgeColor?: "destructive" | "warning";
    children: React.ReactNode;
  }) => (
    <div className="ring-1 ring-border rounded-sm">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{title}</h2>
        {badge !== undefined && badge > 0 && (
          <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
            badgeColor === "destructive"
              ? "bg-destructive/10 text-destructive"
              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
          }`}>
            {badge}
          </span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );

  const SkeletonRows = ({ count = 3 }: { count?: number }) => (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );

  const EmptyState = ({ text }: { text: string }) => (
    <p className="text-sm text-muted-foreground">{text}</p>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold tracking-display">Dashboard</h1>
        {perms.kanOpretteMoeder && (
          <Button size="sm" className="press-effect" onClick={() => navigate("/moeder/nyt")}>
            <Plus className="h-4 w-4 mr-1" />
            Nyt møde
          </Button>
        )}
      </div>

      {deletionDate && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-start gap-3 mb-6">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-destructive">Sletning anmodet</p>
            <p className="text-sm text-muted-foreground">
              Din forening slettes den {formatShortDate(deletionDate)}.
            </p>
          </div>
        </div>
      )}

      {/* Forfaldne handlingspunkter — vises øverst som advarsel */}
      {!loading && overdueActions.length > 0 && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-sm p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <p className="text-sm font-semibold text-destructive">
              {overdueActions.length} forfaldne handlingspunkt{overdueActions.length !== 1 ? "er" : ""}
            </p>
          </div>
          <div className="space-y-2">
            {overdueActions.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate(a.meeting_id ? `/moeder/${a.meeting_id}` : "/handlingspunkter")}
                className="w-full text-left flex items-center justify-between hover:bg-destructive/5 rounded px-2 py-1 -mx-2 transition-colors"
              >
                <p className="text-sm font-medium">{a.title}</p>
                <p className="text-xs text-destructive ml-3 shrink-0">
                  Frist: {a.due_date ? formatShortDate(a.due_date) : "—"}
                </p>
              </button>
            ))}
          </div>
          <button onClick={() => navigate("/handlingspunkter")} className="text-xs text-destructive hover:underline mt-2 block">
            Se alle handlingspunkter →
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Kommende møder */}
        <Section title="Kommende møder" icon={FileText}>
          {loading ? (
            <SkeletonRows />
          ) : upcomingMeetings.length === 0 ? (
            <EmptyState text="Ingen kommende møder." />
          ) : (
            <div className="space-y-3">
              {upcomingMeetings.map((m) => (
                <button
                  key={m.id}
                  onClick={() => navigate(`/moeder/${m.id}`)}
                  className="w-full flex items-center justify-between p-2 -m-2 rounded hover:bg-muted transition-colors text-left"
                >
                  <div>
                    <p className="text-sm font-medium">{m.title}</p>
                    {m.meeting_date && (
                      <p className="text-xs text-muted-foreground">{formatShortDate(m.meeting_date)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={m.status || "draft"} />
                    <MeetingTypeBadge meetingType={m.meeting_type || "bestyrelsesoede"} />
                  </div>
                </button>
              ))}
              <button onClick={() => navigate("/moeder")} className="text-xs text-primary hover:underline mt-1 block">
                Se alle møder →
              </button>
            </div>
          )}
        </Section>

        {/* Afventer godkendelse */}
        {(loading || pendingMeetings.length > 0) && (
          <Section title="Afventer godkendelse" icon={Clock} badge={pendingMeetings.length} badgeColor="warning">
            {loading ? (
              <SkeletonRows />
            ) : (
              <div className="space-y-3">
                {pendingMeetings.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => navigate(`/moeder/${m.id}`)}
                    className="w-full flex items-center justify-between p-2 -m-2 rounded hover:bg-muted transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-medium">{m.title}</p>
                      {m.meeting_date && (
                        <p className="text-xs text-muted-foreground">{formatShortDate(m.meeting_date)}</p>
                      )}
                    </div>
                    <StatusBadge status="pending_approval" />
                  </button>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* Mine åbne handlingspunkter */}
        <Section title="Mine handlingspunkter" icon={ClipboardCheck} badge={overdueActions.length} badgeColor="destructive">
          {loading ? (
            <SkeletonRows count={5} />
          ) : actions.length === 0 && overdueActions.length === 0 ? (
            <EmptyState text="Ingen åbne handlingspunkter. Godt klaret!" />
          ) : (
            <div className="space-y-3">
              {actions.map((a) => (
                <button
                  key={a.id}
                  onClick={() => navigate(a.meeting_id ? `/moeder/${a.meeting_id}` : "/handlingspunkter")}
                  className="w-full text-left flex items-center justify-between hover:bg-muted rounded p-1 -mx-1 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.meetings?.title || "Intet møde"}
                      {a.due_date && ` · Frist: ${formatShortDate(a.due_date)}`}
                    </p>
                  </div>
                </button>
              ))}
              <button onClick={() => navigate("/handlingspunkter")} className="text-xs text-primary hover:underline mt-1 block">
                Se alle handlingspunkter →
              </button>
            </div>
          )}
        </Section>

        {/* Seneste dokumenter */}
        {perms.kanSeDokumenter && (
          <Section title="Seneste dokumenter" icon={FolderOpen}>
            {loading ? (
              <SkeletonRows />
            ) : documents.length === 0 ? (
              <EmptyState text="Ingen dokumenter endnu." />
            ) : (
              <div className="space-y-3">
                {documents.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => navigate("/dokumenter")}
                    className="w-full flex items-center justify-between p-2 -m-2 rounded hover:bg-muted transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-medium">{d.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{d.category || "Andet"}</p>
                    </div>
                  </button>
                ))}
                <button onClick={() => navigate("/dokumenter")} className="text-xs text-primary hover:underline mt-1 block">
                  Se alle dokumenter →
                </button>
              </div>
            )}
          </Section>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
