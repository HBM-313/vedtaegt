import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { useOrg } from "@/components/AppLayout";
import { formatShortDate } from "@/lib/format";
import { usePermissions } from "@/hooks/usePermissions";
import { Plus, FileText, ClipboardCheck, FolderOpen, AlertTriangle } from "lucide-react";

interface Meeting {
  id: string;
  title: string;
  meeting_date: string | null;
  status: string | null;
}

interface ActionItem {
  id: string;
  title: string;
  due_date: string | null;
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
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletionDate, setDeletionDate] = useState<Date | null>(null);

  useEffect(() => {
    if (!orgId) return;

    const load = async () => {
      setLoading(true);

      // Check deletion status
      const { data: orgData } = await supabase
        .from("organizations")
        .select("deletion_requested_at")
        .eq("id", orgId)
        .single();
      if (orgData?.deletion_requested_at) {
        setDeletionDate(new Date(new Date(orgData.deletion_requested_at).getTime() + 30 * 24 * 60 * 60 * 1000));
      }

      const [meetingsRes, actionsRes, docsRes] = await Promise.all([
        supabase
          .from("meetings")
          .select("id, title, meeting_date, status")
          .eq("org_id", orgId)
          .gte("meeting_date", new Date().toISOString())
          .order("meeting_date", { ascending: true })
          .limit(3),
        memberId
          ? supabase
              .from("action_items")
              .select("id, title, due_date, meetings(title)")
              .eq("org_id", orgId)
              .eq("assigned_to", memberId)
              .eq("status", "open")
              .order("due_date", { ascending: true })
              .limit(5)
          : Promise.resolve({ data: [] }),
        supabase
          .from("documents")
          .select("id, name, category, created_at")
          .eq("org_id", orgId)
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

      setMeetings((meetingsRes.data as Meeting[]) || []);
      setActions((actionsRes.data as ActionItem[]) || []);
      setDocuments((docsRes.data as Document[]) || []);
      setLoading(false);
    };

    load();
  }, [orgId, memberId]);

  const Section = ({
    title,
    icon: Icon,
    children,
  }: {
    title: string;
    icon: React.ElementType;
    children: React.ReactNode;
  }) => (
    <div className="ring-1 ring-border rounded-sm">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{title}</h2>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming meetings */}
        <Section title="Kommende møder" icon={FileText}>
          {loading ? (
            <SkeletonRows />
          ) : meetings.length === 0 ? (
            <EmptyState text="Ingen kommende møder. Opret dit første møde." />
          ) : (
            <div className="space-y-3">
              {meetings.map((m) => (
                <button
                  key={m.id}
                  onClick={() => navigate(`/moeder/${m.id}`)}
                  className="w-full flex items-center justify-between p-2 -m-2 rounded hover:bg-muted transition-colors text-left"
                >
                  <div>
                    <p className="text-sm font-medium">{m.title}</p>
                    {m.meeting_date && (
                      <p className="text-xs text-muted-foreground">
                        {formatShortDate(m.meeting_date)}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={m.status || "draft"} />
                </button>
              ))}
            </div>
          )}
        </Section>

        {/* Open action items */}
        <Section title="Mine åbne handlingspunkter" icon={ClipboardCheck}>
          {loading ? (
            <SkeletonRows count={5} />
          ) : actions.length === 0 ? (
            <EmptyState text="Ingen åbne handlingspunkter. Godt klaret!" />
          ) : (
            <div className="space-y-3">
              {actions.map((a) => (
                <div key={a.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {(a.meetings as any)?.title || "Intet møde"}
                      {a.due_date && ` · Frist: ${formatShortDate(a.due_date)}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Recent documents */}
        <Section title="Seneste dokumenter" icon={FolderOpen}>
          {loading ? (
            <SkeletonRows />
          ) : documents.length === 0 ? (
            <EmptyState text="Ingen dokumenter endnu. Upload dit første dokument." />
          ) : (
            <div className="space-y-3">
              {documents.map((d) => (
                <div key={d.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {d.category || "Andet"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
};

export default Dashboard;
