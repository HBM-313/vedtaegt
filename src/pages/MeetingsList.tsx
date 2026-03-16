import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { useOrg } from "@/components/AppLayout";
import { formatShortDate } from "@/lib/format";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Meeting {
  id: string;
  title: string;
  meeting_date: string | null;
  location: string | null;
  status: string | null;
}

const filterTabs = [
  { key: "all", label: "Alle" },
  { key: "draft", label: "Kladde" },
  { key: "active", label: "Aktive" },
  { key: "pending_approval", label: "Afventer" },
  { key: "approved", label: "Godkendte" },
];

const MeetingsList = () => {
  const navigate = useNavigate();
  const { orgId } = useOrg();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!orgId) return;

    const load = async () => {
      setLoading(true);
      let query = supabase
        .from("meetings")
        .select("id, title, meeting_date, location, status")
        .eq("org_id", orgId)
        .order("meeting_date", { ascending: false });

      if (filter === "draft") query = query.eq("status", "draft");
      if (filter === "active") query = query.eq("status", "active");
      if (filter === "pending_approval") query = query.eq("status", "pending_approval");
      if (filter === "approved") query = query.eq("status", "approved");

      const { data } = await query;
      setMeetings((data as Meeting[]) || []);
      setLoading(false);
    };

    load();
  }, [orgId, filter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold tracking-display">Møder</h1>
        <Button size="sm" className="press-effect" onClick={() => navigate("/moeder/nyt")}>
          <Plus className="h-4 w-4 mr-1" />
          Nyt møde
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-0 border-b border-border mb-6">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              "px-4 py-2 text-xs font-medium transition-colors",
              filter === tab.key
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : meetings.length === 0 ? (
        <div className="ring-1 ring-border rounded-sm p-8 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            {filter === "all"
              ? "Ingen møder endnu. Opret dit første møde."
              : "Ingen møder matcher filteret."}
          </p>
          {filter === "all" && (
            <Button size="sm" onClick={() => navigate("/moeder/nyt")}>
              Opret møde
            </Button>
          )}
        </div>
      ) : (
        <div className="ring-1 ring-border rounded-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Titel</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3 hidden sm:table-cell">Dato</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3 hidden md:table-cell">Sted</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => navigate(`/moeder/${m.id}`)}
                  className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <td className="p-3 text-sm font-medium">{m.title}</td>
                  <td className="p-3 text-sm text-muted-foreground hidden sm:table-cell">
                    {m.meeting_date ? formatShortDate(m.meeting_date) : "—"}
                  </td>
                  <td className="p-3 text-sm text-muted-foreground hidden md:table-cell">
                    {m.location || "—"}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={m.status || "draft"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MeetingsList;
