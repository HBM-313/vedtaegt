import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Meeting {
  id: string;
  org_id: string;
  title: string;
  meeting_date: string | null;
  location: string | null;
  status: string;
  meeting_type: string | null;
  share_pin_hash: string | null;
  approved_at: string | null;
  godkendelse_runde: number | null;
}

interface AgendaItem { id: string; title: string; description: string | null; sort_order: number | null; }
interface Afstemning {
  agenda_item_id: string; spoergsmaal: string;
  ja_antal: number; nej_antal: number; undladt_antal: number;
  er_hemmelig: boolean; noter: string | null;
}
interface Content {
  agenda_items: AgendaItem[] | null;
  minutes_content: string | null;
  afstemninger: Afstemning[] | null;
  fremmoedte_antal: number;
}

const formatDanish = (iso: string | null) => {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("da-DK", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
};

const SharedReferatPage = () => {
  const { token } = useParams<{ token: string }>();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [content, setContent] = useState<Content | null>(null);
  const [orgName, setOrgName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [pinRequired, setPinRequired] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return; }
    const load = async () => {
      const { data: meetings } = await supabase
        .rpc("get_meeting_by_share_token", { _token: token });
      if (!meetings || meetings.length === 0) { setNotFound(true); setLoading(false); return; }
      const m = meetings[0] as Meeting;
      setMeeting(m);

      if (m.share_pin_hash) {
        setPinRequired(true);
        setLoading(false);
        return;
      }

      await loadContent(token);
    };
    load();
  }, [token]);

  const loadContent = async (tok: string) => {
    const { data: meetingRows } = await supabase
      .rpc("get_meeting_by_share_token", { _token: tok });
    if (meetingRows?.[0]) {
      const m = meetingRows[0] as Meeting;
      setMeeting(m);
      // Hent org-navn
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", m.org_id)
        .single();
      setOrgName(org?.name || "");
    }

    const { data: contentData } = await supabase
      .rpc("get_shared_meeting_content", { _token: tok });
    if (contentData) {
      setContent(contentData as Content);
    }
    setLoading(false);
    setUnlocked(true);
  };

  const handlePinSubmit = async () => {
    if (!meeting || !token) return;
    // Simpel hash-sammenligning: vi bruger SHA-256 af PIN via Web Crypto
    const encoder = new TextEncoder();
    const data = encoder.encode(pinInput);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    if (hashHex === meeting.share_pin_hash) {
      setPinError(false);
      await loadContent(token);
    } else {
      setPinError(true);
      setPinInput("");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Henter referat...</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3 max-w-sm">
          <Shield className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="font-medium">Referatet blev ikke fundet</p>
          <p className="text-sm text-muted-foreground">Linket er ugyldigt eller er blevet deaktiveret af foreningen.</p>
        </div>
      </div>
    );
  }

  if (pinRequired && !unlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <Lock className="h-8 w-8 text-muted-foreground mx-auto" />
            <h1 className="text-lg font-semibold">{meeting?.title}</h1>
            <p className="text-sm text-muted-foreground">Dette referat er beskyttet med en PIN-kode.</p>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">PIN-kode</Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinInput}
                onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, "")); setPinError(false); }}
                onKeyDown={(e) => e.key === "Enter" && handlePinSubmit()}
                placeholder="••••••"
                className={pinError ? "border-destructive" : ""}
                autoFocus
              />
              {pinError && <p className="text-xs text-destructive">Forkert PIN-kode. Prøv igen.</p>}
            </div>
            <Button className="w-full" onClick={handlePinSubmit} disabled={pinInput.length < 4}>
              Åbn referat
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const minutesMap: Record<string, string> = (() => {
    if (!content?.minutes_content) return {};
    try { return JSON.parse(content.minutes_content); } catch { return {}; }
  })();

  const afstemningMap: Record<string, Afstemning> = {};
  content?.afstemninger?.forEach((a) => { afstemningMap[a.agenda_item_id] = a; });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{orgName || "Vedtægt"}</span>
          </div>
          <span className="text-xs text-muted-foreground">Offentliggjort referat</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{meeting?.title}</h1>
          {meeting?.meeting_date && (
            <p className="text-sm text-muted-foreground">{formatDanish(meeting.meeting_date)}</p>
          )}
          {meeting?.location && (
            <p className="text-sm text-muted-foreground">{meeting.location}</p>
          )}
          {content && content.fremmoedte_antal > 0 && (
            <p className="text-sm text-muted-foreground">{content.fremmoedte_antal} fremmødte</p>
          )}
        </div>

        {/* Dagsorden og referat */}
        {content?.agenda_items && content.agenda_items.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold border-b border-border pb-2">Dagsorden og referat</h2>
            {[...content.agenda_items]
              .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
              .map((item, i) => {
                const minText = minutesMap[item.id] || "";
                const afstemning = afstemningMap[item.id];
                return (
                  <div key={item.id} className="space-y-2">
                    <h3 className="text-sm font-semibold">{i + 1}. {item.title}</h3>
                    {item.description && (
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    )}
                    {minText && (
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{minText}</p>
                    )}
                    {afstemning && (
                      <div className="rounded-sm bg-muted/40 border border-border p-3 text-sm space-y-1">
                        <p className="font-medium text-xs">
                          {afstemning.er_hemmelig ? "Hemmelig afstemning" : "Afstemning"}: {afstemning.spoergsmaal}
                        </p>
                        <div className="flex gap-4 text-xs">
                          <span className="text-green-700 dark:text-green-400">Ja: {afstemning.ja_antal}</span>
                          <span className="text-red-700 dark:text-red-400">Nej: {afstemning.nej_antal}</span>
                          <span className="text-muted-foreground">Undladt: {afstemning.undladt_antal}</span>
                        </div>
                        {afstemning.noter && <p className="text-xs text-muted-foreground italic">{afstemning.noter}</p>}
                      </div>
                    )}
                    {!minText && !afstemning && (
                      <p className="text-sm text-muted-foreground italic">Intet referat for dette punkt.</p>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        <footer className="border-t border-border pt-4 text-xs text-muted-foreground text-center">
          Offentliggjort via Vedtægt · {orgName}
        </footer>
      </main>
    </div>
  );
};

export default SharedReferatPage;
