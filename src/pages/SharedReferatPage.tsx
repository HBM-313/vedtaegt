import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageSeo from "@/components/PageSeo";

interface Meeting {
  id: string;
  org_id: string;
  title: string;
  meeting_date: string | null;
  location: string | null;
  status: string;
  meeting_type: string | null;
  pin_required: boolean;
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
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return; }
    const load = async () => {
      const { data: meetings } = await supabase
        .rpc("get_meeting_by_share_token", { _token: token });
      if (!meetings || meetings.length === 0) { setNotFound(true); setLoading(false); return; }
      const m = meetings[0] as unknown as Meeting;
      setMeeting(m);

      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", m.org_id)
        .maybeSingle();
      setOrgName(org?.name || "");

      if (m.pin_required) {
        setPinRequired(true);
        setLoading(false);
        return;
      }

      await loadContent(token, null);
    };
    load();
  }, [token]);

  const loadContent = async (tok: string, pin: string | null): Promise<"ok" | "invalid_pin" | "error"> => {
    const { data: contentData, error } = await supabase
      .rpc("get_shared_meeting_content", { _token: tok, _pin: pin });

    if (error) {
      setLoading(false);
      return "error";
    }

    // Server returns { error: 'pin_required' | 'invalid_pin' } when PIN check fails
    if (contentData && typeof contentData === "object" && !Array.isArray(contentData) && (contentData as { error?: string }).error) {
      setLoading(false);
      return "invalid_pin";
    }

    if (contentData) {
      setContent(contentData as unknown as Content);
    }
    setLoading(false);
    setUnlocked(true);
    return "ok";
  };

  const handlePinSubmit = async () => {
    if (!meeting || !token || verifying) return;
    setVerifying(true);
    const result = await loadContent(token, pinInput);
    setVerifying(false);
    if (result === "invalid_pin") {
      setPinError(true);
      setPinInput("");
    } else if (result === "error") {
      setPinError(true);
    } else {
      setPinError(false);
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
            <Button className="w-full" onClick={handlePinSubmit} disabled={pinInput.length < 4 || verifying}>
              {verifying ? "Kontrollerer..." : "Åbn referat"}
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
      <PageSeo
        title={`${meeting?.title || "Referat"}${orgName ? ` — ${orgName}` : ""} | Vedtægt`}
        description={`Offentliggjort referat fra ${meeting?.title || "møde"}${orgName ? ` i ${orgName}` : ""}. Læs dagsorden, beslutninger og afstemninger.`}
        path={`/referat/${token}`}
        ogType="article"
        noindex
      />
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
