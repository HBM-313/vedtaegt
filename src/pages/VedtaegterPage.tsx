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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle, Plus, Trash2 } from "lucide-react";

interface Version {
  id: string;
  version_label: string;
  er_gaeldende: boolean;
  godkendt_dato: string | null;
  noter: string | null;
  created_at: string;
  document_id: string | null;
  moede_id: string | null;
  oprettet_af: string | null;
  documents: { name: string; storage_path: string } | null;
  meetings: { title: string } | null;
  uploader: { name: string } | null;
}

const formatDanishDateTime = (iso: string) =>
  new Intl.DateTimeFormat("da-DK", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));

const VedtaegterPage = () => {
  const { orgId, memberId } = useOrg();
  const perms = usePermissions();
  const [versioner, setVersioner] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Version | null>(null);

  // Ny version form
  const [label, setLabel] = useState("");
  const [godkendtDato, setGodkendtDato] = useState("");
  const [noter, setNoter] = useState("");
  const [fil, setFil] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Adgangsstyring:
  // Upload kræver kanUploadeDokumenter
  // Slet kræver erFormand ELLER kanSletteDokumenter
  const kanUploade = perms.kanUploadeDokumenter;
  const kanSlette = perms.erFormand || perms.kanSletteDokumenter;
  const kanSaetGaeldende = perms.kanRedigereForening;

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("vedtaegt_versioner")
      .select(`
        id, version_label, er_gaeldende, godkendt_dato, noter,
        created_at, document_id, moede_id, oprettet_af,
        documents(name, storage_path),
        meetings(title),
        uploader:oprettet_af(name)
      `)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("VedtaegterPage: fejl ved hentning:", error.message);
    }
    setVersioner((data as unknown as Version[]) || []);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const handleSaetGaeldende = async (id: string) => {
    if (!orgId || !kanSaetGaeldende) return;
    try {
      await supabase
        .from("vedtaegt_versioner")
        .update({ er_gaeldende: false })
        .eq("org_id", orgId);
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

  const handleSlet = async () => {
    if (!deleteTarget || !kanSlette || !orgId) return;
    try {
      // Slet tilknyttet dokument fra storage og documents-tabel
      if (deleteTarget.documents?.storage_path) {
        await supabase.storage
          .from("documents")
          .remove([deleteTarget.documents.storage_path]);
        if (deleteTarget.document_id) {
          await supabase.from("documents").delete().eq("id", deleteTarget.document_id);
        }
      }
      const { error } = await supabase
        .from("vedtaegt_versioner")
        .delete()
        .eq("id", deleteTarget.id);
      if (error) throw error;
      await logAuditEvent("vedtaegt.version_slettet", "vedtaegt_version", deleteTarget.id, {
        version_label: deleteTarget.version_label,
      }, orgId);
      toast.success("Vedtægtsversion slettet.");
      setDeleteTarget(null);
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Kunne ikke slette version.";
      toast.error(msg);
    }
  };

  const handleOpretVersion = async () => {
    if (!label.trim()) { toast.error("Angiv en versionsbetegnelse."); return; }
    if (!orgId || !memberId) return;
    if (!kanUploade) { toast.error("Du har ikke tilladelse til at uploade vedtægter."); return; }
    setSaving(true);
    try {
      let documentId: string | null = null;

      if (fil) {
        const uuid = crypto.randomUUID();
        const filePath = `${orgId}/${uuid}/${fil.name}`;
        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(filePath, fil);
        if (uploadError) throw new Error(`Upload fejlede: ${uploadError.message}`);

        const { data: docData, error: docError } = await supabase
          .from("documents")
          .insert({
            org_id: orgId,
            name: fil.name,
            storage_path: filePath,
            file_type: fil.type,
            file_size_bytes: fil.size,
            category: "vedtaegt",
            kilde: "vedtaegt",        // skjul fra den almene dokumentliste
            uploaded_by: memberId,
          })
          .select()
          .single();
        if (docError) throw new Error(`Dokumentregistrering fejlede: ${docError.message}`);
        documentId = docData.id;
      }

      // Brug as any da vedtaegt_versioner ikke er i de auto-genererede Supabase-typer
      const { data: newVersion, error } = await (supabase
        .from("vedtaegt_versioner") as any)
        .insert({
          org_id: orgId,
          version_label: label.trim(),
          er_gaeldende: false,
          godkendt_dato: godkendtDato || null,
          noter: noter.trim() || null,
          document_id: documentId,
          oprettet_af: memberId,
        })
        .select()
        .single();
      if (error) throw new Error(`Versionsoprettelse fejlede: ${error.message}`);

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
        {kanUploade && (
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
          {kanUploade && (
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
                      Godkendt: {new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "long", year: "numeric" }).format(new Date(v.godkendt_dato))}
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
                    Uploadet: {formatDanishDateTime(v.created_at)}
                    {v.uploader ? ` · af ${v.uploader.name}` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  {v.documents && (
                    <Button variant="outline" size="sm" onClick={() => handleDownload(v)}>
                      <FileText className="h-3.5 w-3.5 mr-1" /> Hent
                    </Button>
                  )}
                  {kanSaetGaeldende && !v.er_gaeldende && (
                    <Button variant="outline" size="sm" onClick={() => handleSaetGaeldende(v.id)}>
                      <CheckCircle className="h-3.5 w-3.5 mr-1" /> Sæt som gældende
                    </Button>
                  )}
                  {kanSlette && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(v)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Opret ny version dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) { setLabel(""); setGodkendtDato(""); setNoter(""); setFil(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Tilføj vedtægtsversion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vl-label" className="text-xs">Versionsbetegnelse</Label>
              <Input
                id="vl-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="F.eks. Vedtægt 2024 eller v3.1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vl-dato" className="text-xs">
                Godkendelsesdato <span className="text-muted-foreground">(valgfrit)</span>
              </Label>
              <Input
                id="vl-dato"
                type="date"
                value={godkendtDato}
                onChange={(e) => setGodkendtDato(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vl-noter" className="text-xs">
                Noter <span className="text-muted-foreground">(valgfrit)</span>
              </Label>
              <Input
                id="vl-noter"
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
            <Button onClick={handleOpretVersion} disabled={saving || !label.trim()}>
              {saving ? "Gemmer..." : "Gem version"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Slet bekræftelse */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet vedtægtsversion</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på, at du vil slette "{deleteTarget?.version_label}"?
              {deleteTarget?.er_gaeldende && (
                <span className="block mt-1 font-medium text-destructive">
                  Advarsel: Dette er den gældende vedtægt.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annullér</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSlet}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Slet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VedtaegterPage;
