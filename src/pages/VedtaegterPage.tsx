import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/context/OrgContext";
import { usePermissions } from "@/hooks/usePermissions";
import { logAuditEvent } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatShortDate } from "@/lib/format";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle, Plus } from "lucide-react";

interface Version {
  id: string;
  version_label: string;
  er_gaeldende: boolean;
  godkendt_dato: string | null;
  noter: string | null;
  created_at: string;
  document_id: string | null;
  moede_id: string | null;
  documents: { name: string; storage_path: string } | null;
  meetings: { title: string } | null;
}

const VedtaegterPage = () => {
  const { orgId, memberId } = useOrg();
  const perms = usePermissions();
  const [versioner, setVersioner] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);

  // Ny version form
  const [label, setLabel] = useState("");
  const [godkendtDato, setGodkendtDato] = useState("");
  const [noter, setNoter] = useState("");
  const [fil, setFil] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const { data } = await supabase
      .from("vedtaegt_versioner")
      .select("id, version_label, er_gaeldende, godkendt_dato, noter, created_at, document_id, moede_id, documents(name, storage_path), meetings(title)")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    setVersioner((data as Version[]) || []);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const handleSaetGaeldende = async (id: string) => {
    if (!orgId) return;
    try {
      // Nulstil alle andre
      await supabase
        .from("vedtaegt_versioner")
        .update({ er_gaeldende: false })
        .eq("org_id", orgId);
      // Sæt denne som gældende
      await supabase
        .from("vedtaegt_versioner")
        .update({ er_gaeldende: true })
        .eq("id", id);
      await logAuditEvent("vedtaegt.gaeldende_sat", "vedtaegt_version", id, {}, orgId);
      toast.success("Gældende vedtægt opdateret.");
      load();
    } catch {
      toast.error("Kunne ikke opdatere gældende vedtægt.");
    }
  };

  const handleOpretVersion = async () => {
    if (!label.trim()) { toast.error("Angiv en versionsbetegnelse."); return; }
    if (!orgId || !memberId) return;
    setSaving(true);
    try {
      let documentId: string | null = null;

      // Upload fil hvis valgt
      if (fil) {
        const filePath = `${orgId}/${crypto.randomUUID()}/${fil.name}`;
        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(filePath, fil);
        if (uploadError) throw uploadError;

        const { data: docData, error: docError } = await supabase
          .from("documents")
          .insert({
            org_id: orgId,
            name: fil.name,
            storage_path: filePath,
            file_type: fil.type,
            file_size_bytes: fil.size,
            category: "vedtaegt",
            uploaded_by: memberId,
          })
          .select()
          .single();
        if (docError) throw docError;
        documentId = docData.id;
      }

      const { data: newVersion, error } = await supabase
        .from("vedtaegt_versioner")
        .insert({
          org_id: orgId,
          version_label: label.trim(),
          er_gaeldende: false,
          godkendt_dato: godkendtDato || null,
          noter: noter.trim() || null,
          document_id: documentId,
        })
        .select()
        .single();
      if (error) throw error;

      await logAuditEvent("vedtaegt.version_oprettet", "vedtaegt_version", newVersion.id, {
        version_label: label.trim(),
      }, orgId);

      toast.success("Ny vedtægtsversion oprettet.");
      setShowDialog(false);
      setLabel(""); setGodkendtDato(""); setNoter(""); setFil(null);
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Kunne ikke oprette version.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async (version: Version) => {
    if (!version.documents?.storage_path) return;
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrl(version.documents.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-display">Vedtægter</h1>
        {perms.kanRedigereForening && (
          <Button size="sm" className="press-effect" onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-1" /> Ny version
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : versioner.length === 0 ? (
        <div className="ring-1 ring-border rounded-sm p-8 text-center">
          <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            Ingen vedtægtsversioner endnu. Tilføj foreningens gældende vedtægt.
          </p>
          {perms.kanRedigereForening && (
            <Button size="sm" onClick={() => setShowDialog(true)}>
              <Plus className="h-4 w-4 mr-1" /> Tilføj vedtægt
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {versioner.map((v) => (
            <div key={v.id} className="ring-1 ring-border rounded-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{v.version_label}</p>
                    {v.er_gaeldende && (
                      <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-transparent dark:bg-green-900/30 dark:text-green-400">
                        Gældende
                      </Badge>
                    )}
                  </div>
                  {v.godkendt_dato && (
                    <p className="text-xs text-muted-foreground">
                      Godkendt: {formatShortDate(v.godkendt_dato)}
                    </p>
                  )}
                  {v.meetings && (
                    <p className="text-xs text-muted-foreground">
                      Vedtaget på: {v.meetings.title}
                    </p>
                  )}
                  {v.noter && (
                    <p className="text-xs text-muted-foreground italic">{v.noter}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Tilføjet: {formatShortDate(v.created_at)}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {v.documents && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(v)}
                    >
                      <FileText className="h-3.5 w-3.5 mr-1" /> Hent
                    </Button>
                  )}
                  {perms.kanRedigereForening && !v.er_gaeldende && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSaetGaeldende(v.id)}
                    >
                      <CheckCircle className="h-3.5 w-3.5 mr-1" /> Sæt som gældende
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Opret ny version dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Tilføj vedtægtsversion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="label" className="text-xs">Versionsbetegnelse</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="F.eks. Vedtægt 2024 eller v3.1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dato" className="text-xs">
                Godkendelsesdato <span className="text-muted-foreground">(valgfrit)</span>
              </Label>
              <Input
                id="dato"
                type="date"
                value={godkendtDato}
                onChange={(e) => setGodkendtDato(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="noter-v" className="text-xs">
                Noter <span className="text-muted-foreground">(valgfrit)</span>
              </Label>
              <Input
                id="noter-v"
                value={noter}
                onChange={(e) => setNoter(e.target.value)}
                placeholder="F.eks. Ændringer fra generalforsamling 2024"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">
                Dokument <span className="text-muted-foreground">(valgfrit)</span>
              </Label>
              <label className="flex items-center gap-2 cursor-pointer ring-1 ring-border rounded-sm p-3 hover:bg-muted/40 transition-colors">
                <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground truncate">
                  {fil ? fil.name : "Vælg PDF eller Word-fil..."}
                </span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => setFil(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Annullér</Button>
            <Button onClick={handleOpretVersion} disabled={saving}>
              {saving ? "Gemmer..." : "Gem version"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VedtaegterPage;
