import { useEffect, useState, useCallback, useRef } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/context/OrgContext";
import { usePermissions } from "@/hooks/usePermissions";
import { logAuditEvent } from "@/lib/audit";
import { formatShortDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Plus, Search, X, Upload, Users, CheckCircle2, XCircle, Pencil, Trash2, Download,
} from "lucide-react";

interface Foreningsmedlem {
  id: string;
  navn: string;
  email: string | null;
  telefon: string | null;
  adresse: string | null;
  postnummer: string | null;
  by: string | null;
  foedselsdato: string | null;
  tilmeldingsdato: string;
  stemmeberettiget: boolean;
  kontingent_status: "betalt" | "ikke_betalt" | "fritaget";
  kontingent_beloeb: number | null;
  kontingentaar: number;
  noter: string | null;
}

const nuvaerende_aar = new Date().getFullYear();

const STATUS_CONFIG = {
  betalt: { label: "Betalt", color: "bg-green-100 text-green-800 border-transparent dark:bg-green-900/30 dark:text-green-400" },
  ikke_betalt: { label: "Ikke betalt", color: "bg-red-100 text-red-800 border-transparent dark:bg-red-900/30 dark:text-red-400" },
  fritaget: { label: "Fritaget", color: "bg-muted text-muted-foreground border-transparent" },
};

const emptyForm = (): Partial<Foreningsmedlem> => ({
  navn: "",
  email: "",
  telefon: "",
  adresse: "",
  postnummer: "",
  by: "",
  foedselsdato: undefined,
  tilmeldingsdato: new Date().toISOString().split("T")[0],
  stemmeberettiget: true,
  kontingent_status: "ikke_betalt",
  kontingent_beloeb: undefined,
  kontingentaar: nuvaerende_aar,
  noter: "",
});

const MedlemsregisterPage = () => {
  const { orgId } = useOrg();
  const perms = usePermissions();
  const [medlemmer, setMedlemmer] = useState<Foreningsmedlem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [showDialog, setShowDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<Foreningsmedlem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Foreningsmedlem | null>(null);
  const [form, setForm] = useState<Partial<Foreningsmedlem>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importPreview, setImportPreview] = useState<{ navn: string; email: string }[]>([]);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const kanAdmin = perms.kanAdministrereMedlemsregister;

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const { data } = await supabase
      .from("foreningsmedlemmer")
      .select("*")
      .eq("org_id", orgId)
      .order("navn", { ascending: true });
    setMedlemmer((data as Foreningsmedlem[]) || []);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  if (perms.loaded && !perms.kanSeIndstillinger && !kanAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const filtered = medlemmer.filter((m) => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      m.navn.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      m.telefon?.includes(q);
    const matchStatus = statusFilter === "alle" || m.kontingent_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: medlemmer.length,
    betalt: medlemmer.filter((m) => m.kontingent_status === "betalt").length,
    stemmeberettiget: medlemmer.filter((m) => m.stemmeberettiget).length,
    samletBeloeb: medlemmer
      .filter((m) => m.kontingent_status === "betalt" && m.kontingent_beloeb)
      .reduce((sum, m) => sum + (m.kontingent_beloeb ?? 0), 0),
  };

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm());
    setShowDialog(true);
  };

  const openEdit = (m: Foreningsmedlem) => {
    setEditTarget(m);
    setForm({ ...m });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.navn?.trim()) { toast.error("Navn er påkrævet."); return; }
    if (!orgId) return;
    setSaving(true);
    try {
      const payload = {
        org_id: orgId,
        navn: form.navn.trim(),
        email: form.email?.trim() || null,
        telefon: form.telefon?.trim() || null,
        adresse: form.adresse?.trim() || null,
        postnummer: form.postnummer?.trim() || null,
        by: form.by?.trim() || null,
        foedselsdato: form.foedselsdato || null,
        tilmeldingsdato: form.tilmeldingsdato || new Date().toISOString().split("T")[0],
        stemmeberettiget: form.stemmeberettiget ?? true,
        kontingent_status: form.kontingent_status ?? "ikke_betalt",
        kontingent_beloeb: form.kontingent_beloeb ?? null,
        kontingentaar: form.kontingentaar ?? nuvaerende_aar,
        noter: form.noter?.trim() || null,
      };

      if (editTarget) {
        const { error } = await supabase
          .from("foreningsmedlemmer")
          .update(payload)
          .eq("id", editTarget.id);
        if (error) throw error;
        await logAuditEvent("foreningsmedlem.opdateret", "foreningsmedlem", editTarget.id, { navn: payload.navn });
        toast.success("Medlem opdateret.");
      } else {
        const { data, error } = await supabase
          .from("foreningsmedlemmer")
          .insert(payload)
          .select()
          .single();
        if (error) {
          if (error.message.includes("duplicate")) {
            toast.error("Et medlem med denne e-mail eksisterer allerede.");
            return;
          }
          throw error;
        }
        await logAuditEvent("foreningsmedlem.oprettet", "foreningsmedlem", data.id, { navn: payload.navn });
        toast.success("Medlem tilføjet.");
      }

      setShowDialog(false);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Kunne ikke gemme.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await supabase.from("foreningsmedlemmer").delete().eq("id", deleteTarget.id);
    await logAuditEvent("foreningsmedlem.slettet", "foreningsmedlem", deleteTarget.id, { navn: deleteTarget.navn });
    toast.success(`${deleteTarget.navn} er fjernet.`);
    setDeleteTarget(null);
    load();
  };

  // CSV import
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter(Boolean);
      const parsed: { navn: string; email: string }[] = [];
      // Forsøg at finde kolonner — første linje er header
      const header = lines[0].split(/[;,\t]/).map((h) => h.trim().toLowerCase());
      const navnIdx = header.findIndex((h) => h.includes("navn") || h.includes("name"));
      const emailIdx = header.findIndex((h) => h.includes("email") || h.includes("mail"));
      if (navnIdx === -1) { toast.error("CSV skal have en kolonne med 'navn' eller 'name'."); return; }
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(/[;,\t]/);
        const navn = cols[navnIdx]?.trim().replace(/^"|"$/g, "");
        const email = emailIdx >= 0 ? cols[emailIdx]?.trim().replace(/^"|"$/g, "") : "";
        if (navn) parsed.push({ navn, email: email || "" });
      }
      setImportPreview(parsed);
      setShowImport(true);
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const handleImport = async () => {
    if (!orgId || importPreview.length === 0) return;
    setImporting(true);
    let imported = 0;
    let skipped = 0;
    for (const row of importPreview) {
      const { error } = await supabase.from("foreningsmedlemmer").insert({
        org_id: orgId,
        navn: row.navn,
        email: row.email || null,
        tilmeldingsdato: new Date().toISOString().split("T")[0],
        kontingentaar: nuvaerende_aar,
      });
      if (error?.message.includes("duplicate")) { skipped++; } else { imported++; }
    }
    await logAuditEvent("foreningsmedlem.csv_importeret", "foreningsmedlem", orgId, { imported, skipped });
    toast.success(`${imported} importeret${skipped > 0 ? `, ${skipped} sprunget over (duplikate e-mails)` : ""}.`);
    setShowImport(false);
    setImportPreview([]);
    load();
    setImporting(false);
  };

  const handleExportCSV = () => {
    const header = "Navn;E-mail;Telefon;Kontingent;Beløb;År;Stemmeberettiget;Tilmeldt\n";
    const rows = filtered.map((m) =>
      [m.navn, m.email ?? "", m.telefon ?? "",
       STATUS_CONFIG[m.kontingent_status].label,
       m.kontingent_beloeb ?? "", m.kontingentaar,
       m.stemmeberettiget ? "Ja" : "Nej",
       formatShortDate(m.tilmeldingsdato)
      ].join(";")
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = "foreningsmedlemmer.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const setF = (key: keyof Foreningsmedlem, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-display">Foreningsmedlemmer</h1>
        <div className="flex items-center gap-2">
          {kanAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1" /> Importér CSV
              </Button>
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileChange} />
              <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={filtered.length === 0}>
                <Download className="h-4 w-4 mr-1" /> Eksportér
              </Button>
              <Button size="sm" className="press-effect" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" /> Tilføj medlem
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Statistik */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, icon: Users },
          { label: "Betalt kontingent", value: stats.betalt, icon: CheckCircle2 },
          { label: "Stemmeberettigede", value: stats.stemmeberettiget, icon: CheckCircle2 },
          { label: "Indbetalinger", value: stats.samletBeloeb > 0 ? `${stats.samletBeloeb.toLocaleString("da-DK")} kr` : "—", icon: XCircle },
        ].map((s) => (
          <div key={s.label} className="ring-1 ring-border rounded-sm p-3">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-xl font-semibold mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Søgning + filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input placeholder="Søg navn, e-mail eller telefon..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-9 pr-9" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle statusser</SelectItem>
            <SelectItem value="betalt">Betalt</SelectItem>
            <SelectItem value="ikke_betalt">Ikke betalt</SelectItem>
            <SelectItem value="fritaget">Fritaget</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="ring-1 ring-border rounded-sm p-10 text-center">
          <Users className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">
            {search || statusFilter !== "alle"
              ? "Ingen medlemmer matcher søgningen."
              : "Ingen foreningsmedlemmer endnu. Tilføj det første eller importér en CSV."}
          </p>
          {kanAdmin && !search && statusFilter === "alle" && (
            <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Tilføj medlem</Button>
          )}
        </div>
      ) : (
        <div className="ring-1 ring-border rounded-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Navn</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3 hidden sm:table-cell">E-mail</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Kontingent</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3 hidden md:table-cell">Stemme</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3 hidden lg:table-cell">Tilmeldt</th>
                {kanAdmin && <th className="text-right text-xs font-medium text-muted-foreground p-3">Handling</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="p-3 font-medium">
                    {m.navn}
                    {m.noter && <p className="text-xs text-muted-foreground truncate max-w-48">{m.noter}</p>}
                  </td>
                  <td className="p-3 text-muted-foreground hidden sm:table-cell">{m.email || "—"}</td>
                  <td className="p-3">
                    <Badge variant="outline" className={`text-xs ${STATUS_CONFIG[m.kontingent_status].color}`}>
                      {STATUS_CONFIG[m.kontingent_status].label}
                      {m.kontingent_status === "betalt" && m.kontingent_beloeb
                        ? ` — ${m.kontingent_beloeb.toLocaleString("da-DK")} kr`
                        : ""}
                    </Badge>
                  </td>
                  <td className="p-3 hidden md:table-cell">
                    {m.stemmeberettiget
                      ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                      : <XCircle className="h-4 w-4 text-muted-foreground" />}
                  </td>
                  <td className="p-3 text-muted-foreground hidden lg:table-cell">{formatShortDate(m.tilmeldingsdato)}</td>
                  {kanAdmin && (
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(m)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground p-3 border-t border-border">
            {filtered.length} {filtered.length !== medlemmer.length ? `af ${medlemmer.length} ` : ""}
            {filtered.length === 1 ? "medlem" : "medlemmer"}
          </p>
        </div>
      )}

      {/* Opret/Rediger dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) setShowDialog(false); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">{editTarget ? "Rediger medlem" : "Tilføj foreningsmedlem"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Navn</Label>
                <Input value={form.navn ?? ""} onChange={(e) => setF("navn", e.target.value)} placeholder="Fulde navn" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">E-mail</Label>
                <Input type="email" value={form.email ?? ""} onChange={(e) => setF("email", e.target.value)} placeholder="email@eksempel.dk" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Telefon</Label>
                <Input value={form.telefon ?? ""} onChange={(e) => setF("telefon", e.target.value)} placeholder="+45 12 34 56 78" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Adresse</Label>
                <Input value={form.adresse ?? ""} onChange={(e) => setF("adresse", e.target.value)} placeholder="Gadenavn 1" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Postnummer</Label>
                <Input value={form.postnummer ?? ""} onChange={(e) => setF("postnummer", e.target.value.replace(/\D/g, "").slice(0, 4))} maxLength={4} placeholder="8000" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">By</Label>
                <Input value={form.by ?? ""} onChange={(e) => setF("by", e.target.value)} placeholder="Aarhus C" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fødselsdato <span className="text-muted-foreground">(valgfrit)</span></Label>
                <Input type="date" value={form.foedselsdato ?? ""} onChange={(e) => setF("foedselsdato", e.target.value || null)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tilmeldingsdato</Label>
                <Input type="date" value={form.tilmeldingsdato ?? ""} onChange={(e) => setF("tilmeldingsdato", e.target.value)} />
              </div>
            </div>

            {/* Kontingent */}
            <div className="border-t border-border pt-3 space-y-3">
              <p className="text-xs font-medium">Kontingent {nuvaerende_aar}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select value={form.kontingent_status ?? "ikke_betalt"} onValueChange={(v) => setF("kontingent_status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="betalt">Betalt</SelectItem>
                      <SelectItem value="ikke_betalt">Ikke betalt</SelectItem>
                      <SelectItem value="fritaget">Fritaget</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Beløb i kr <span className="text-muted-foreground">(valgfrit)</span></Label>
                  <Input type="number" min={0} value={form.kontingent_beloeb ?? ""}
                    onChange={(e) => setF("kontingent_beloeb", e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="200" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Kontingentår</Label>
                  <Input type="number" value={form.kontingentaar ?? nuvaerende_aar}
                    onChange={(e) => setF("kontingentaar", parseInt(e.target.value) || nuvaerende_aar)} />
                </div>
              </div>
            </div>

            {/* Stemmeberettiget */}
            <div className="flex items-center gap-2">
              <Checkbox id="stemme" checked={form.stemmeberettiget ?? true}
                onCheckedChange={(v) => setF("stemmeberettiget", v === true)} />
              <Label htmlFor="stemme" className="text-sm cursor-pointer">Stemmeberettiget</Label>
            </div>

            {/* Noter */}
            <div className="space-y-1">
              <Label className="text-xs">Noter <span className="text-muted-foreground">(valgfrit)</span></Label>
              <Textarea value={form.noter ?? ""} onChange={(e) => setF("noter", e.target.value)}
                placeholder="Interne noter om medlemmet..." className="min-h-[60px] text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Annullér</Button>
            <Button onClick={handleSave} disabled={saving || !form.navn?.trim()}>
              {saving ? "Gemmer..." : editTarget ? "Gem ændringer" : "Tilføj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import preview */}
      <Dialog open={showImport} onOpenChange={(open) => { if (!open) { setShowImport(false); setImportPreview([]); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Importér {importPreview.length} medlemmer</DialogTitle>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto ring-1 ring-border rounded-sm divide-y divide-border">
            {importPreview.slice(0, 20).map((row, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="font-medium">{row.navn}</span>
                <span className="text-muted-foreground text-xs">{row.email || "Ingen e-mail"}</span>
              </div>
            ))}
            {importPreview.length > 20 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">... og {importPreview.length - 20} flere</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Eksisterende e-mails springes over. Alle tilføjes som "Ikke betalt" for {nuvaerende_aar}.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowImport(false); setImportPreview([]); }}>Annullér</Button>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? "Importerer..." : `Importér ${importPreview.length} medlemmer`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Slet bekræftelse */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fjern foreningsmedlem</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på, at du vil fjerne <strong>{deleteTarget?.navn}</strong> fra foreningsregisteret?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annullér</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Fjern</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MedlemsregisterPage;
