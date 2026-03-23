import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, MeetingTypeBadge } from "@/components/StatusBadge";
import { useOrg } from "@/context/OrgContext";
import { formatShortDate } from "@/lib/format";
import { usePermissions } from "@/hooks/usePermissions";
import { Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Meeting {
  id: string;
  title: string;
  meeting_date: string | null;
  location: string | null;
  status: string | null;
  meeting_type: string | null;
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
  const perms = usePermissions();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!orgId) return;
    const load = async () => {
      setLoading(true);
      let query = supabase
        .from("meetings")
        .select("id, title, meeting_date, location, status, meeting_type")
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

  const filtered = useMemo(() => {
    if (!search.trim()) return meetings;
    const q = search.toLowerCase();
    return meetings.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.location?.toLowerCase().includes(q) ||
        (m.meeting_date && formatShortDate(m.meeting_date).toLowerCase().includes(q))
    );
  }, [meetings, search]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold tracking-display">Møder</h1>
        {perms.kanOpretteMoeder && (
          <Button size="sm" className="press-effect" onClick={() => navigate("/moeder/nyt")}>
            <Plus className="h-4 w-4 mr-1" />
            Nyt møde
          </Button>
        )}
      </div>

      {/* Søgning */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Søg i møder..."
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

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="ring-1 ring-border rounded-sm p-8 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            {search
              ? `Ingen møder matcher "${search}".`
              : filter === "all"
              ? "Ingen møder endnu. Opret dit første møde."
              : "Ingen møder matcher filteret."}
          </p>
          {!search && filter === "all" && (
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
              {filtered.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => navigate(`/moeder/${m.id}`)}
                  className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <td className="p-3 text-sm font-medium">
                    <div className="flex items-center gap-2 flex-wrap">
                      {m.title}
                      <MeetingTypeBadge meetingType={m.meeting_type || "bestyrelsesoede"} />
                    </div>
                  </td>
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
          {search && (
            <p className="text-xs text-muted-foreground p-3 border-t border-border">
              {filtered.length} af {meetings.length} møder
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default MeetingsList;
