import { useEffect, useState, useCallback } from "react";
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Upload, Download, FileText, Eye, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import DocumentPreviewModal from "@/components/documents/DocumentPreviewModal";

interface Props {
  meetingId: string;
  orgId: string;
  agendaItems: { id: string; title: string }[];
}

interface Doc {
  id: string; name: string; category: string | null; created_at: string | null;
  file_size_bytes: number | null; storage_path: string; uploaded_by: string | null;
  file_type: string | null; agenda_item_id: string | null;
  uploader_name?: string;
}

interface CategoryMeta {
  value: string;
  label: string;
  retention: number;
  color: string;
}

const FALLBACK_CATEGORIES: CategoryMeta[] = [
  { value: "referat", label: "Referat", retention: 10, color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "regnskab", label: "Regnskab", retention: 5, color: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "vedtaegt", label: "Vedtægt", retention: 10, color: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "forsikring", label: "Forsikring", retention: 10, color: "bg-green-100 text-green-800 border-green-200" },
  { value: "other", label: "Øvrige", retention: 3, color: "bg-muted text-muted-foreground border-border" },
];

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const formatBytes = (bytes: number | null) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const MeetingDocumentsTab = ({ meetingId, orgId, agendaItems }: Props) => {
  const { memberId } = useOrg();
  const perms = usePermissions();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [docName, setDocName] = useState("");
  const [category, setCategory] = useState("");
  const [agendaItemId, setAgendaItemId] = useState<string>("none");
  const [uploading, setUploading] = useState(false);

  const [categories, setCategories] = useState<CategoryMeta[]>(FALLBACK_CATEGORIES);

  useEffect(() => {
    if (!orgId) return;
    const loadCats = async () => {
      const { data } = await supabase
        .from("document_categories")
        .select("*")
        .eq("org_id", orgId)
        .eq("er_aktiv", true)
        .order("sort_order", { ascending: true });
      if (data && data.length > 0) {
        setCategories(data.map((c: any) => ({
          value: c.name,
          label: c.label,
          retention: c.retention_years ?? 3,
          color: c.color || "bg-muted text-muted-foreground border-border",
        })));
      }
    };
    loadCats();
  }, [orgId]);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("documents")
      .select("id, name, category, created_at, file_size_bytes, storage_path, uploaded_by, file_type, agenda_item_id")
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: false });

    if (data) {
      const uploaderIds = [...new Set(data.map((d) => d.uploaded_by).filter(Boolean))] as string[];
      let memberMap: Record<string, string> = {};
      if (uploaderIds.length > 0) {
        const { data: members } = await supabase.from("members").select("id, name").in("id", uploaderIds);
        if (members) memberMap = Object.fromEntries(members.map((m) => [m.id, m.name]));
      }
      setDocs(data.map((d: any) => ({
        ...d,
        uploader_name: d.uploaded_by ? memberMap[d.uploaded_by] : undefined,
      })));
    }
    setLoading(false);
  }, [meetingId]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const getCategoryMeta = (cat: string | null) => categories.find((c) => c.value === cat) ?? categories[categories.length - 1];

  const handleFileSelect = (f: File) => {
    if (f.size > MAX_FILE_SIZE) {
      toast.error("Filen er for stor. Maksimal filstørrelse er 25 MB.");
      return;
    }
    setFile(f);
    if (!docName) setDocName(f.name.replace(/\.[^.]+$/, ""));
  };

  const handleUpload = async () => {
    if (!perms.kanUploadeDokumenter) { toast.error("Du har ikke tilladelse til at uploade dokumenter."); return; }
    if (!file || !category || !memberId) return;
    setUploading(true);

    const uuid = crypto.randomUUID();
    const storagePath = `${orgId}/${uuid}/${file.name}`;
    const { error: storageError } = await supabase.storage.from("documents").upload(storagePath, file);
    if (storageError) { toast.error("Upload fejlede: " + storageError.message); setUploading(false); return; }

    const retention = getCategoryMeta(category)?.retention ?? 3;
    const { error: dbError } = await supabase.from("documents").insert({
      org_id: orgId,
      name: docName || file.name,
      category,
      storage_path: storagePath,
      file_size_bytes: file.size,
      file_type: file.type,
      uploaded_by: memberId,
      retention_years: retention,
      meeting_id: meetingId,
      agenda_item_id: agendaItemId !== "none" ? agendaItemId : null,
      kilde: "moede",
    } as any);

    if (dbError) { toast.error("Kunne ikke gemme dokument."); setUploading(false); return; }

    await logAuditEvent("document.uploaded", "document", uuid, { name: docName || file.name, category, meeting_id: meetingId });
    toast.success("Dokument uploadet!");
    setUploadOpen(false); setFile(null); setDocName(""); setCategory(""); setAgendaItemId("none"); setUploading(false);
    fetchDocs();
  };

  const handleDownload = async (doc: Doc) => {
    const { data, error } = await supabase.storage.from("documents").download(doc.storage_path);
    if (error || !data) { toast.error("Kunne ikke downloade filen."); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a"); a.href = url; a.download = doc.name; a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (doc: Doc) => {
    if (!perms.kanSletteDokumenter) { toast.error("Du har ikke tilladelse til at slette dokumenter."); return; }
    await supabase.storage.from("documents").remove([doc.storage_path]);
    await supabase.from("documents").delete().eq("id", doc.id);
    await logAuditEvent("document.deleted", "document", doc.id, { name: doc.name });
    toast.success("Dokument slettet.");
    fetchDocs();
  };

  const ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.doc,.xls";

  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{docs.length} dokument{docs.length !== 1 ? "er" : ""} tilknyttet dette møde</p>
        {perms.kanUploadeDokumenter && (
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Upload dokument
          </Button>
        )}
      </div>

      {docs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Ingen dokumenter tilknyttet dette møde endnu.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => {
            const meta = getCategoryMeta(doc.category);
            const linkedAgenda = agendaItems.find((a) => a.id === doc.agenda_item_id);
            return (
              <div key={doc.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <button className="text-sm font-medium truncate block text-left hover:underline" onClick={() => setPreviewDoc(doc)}>
                      {doc.name}
                    </button>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className={`text-xs ${meta?.color || ""}`}>{meta?.label || doc.category}</Badge>
                      {linkedAgenda && <span>· {linkedAgenda.title}</span>}
                      {doc.uploader_name && <span>· {doc.uploader_name}</span>}
                      <span>· {formatBytes(doc.file_size_bytes)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => setPreviewDoc(doc)}><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDownload(doc)}><Download className="h-4 w-4" /></Button>
                  {perms.kanSletteDokumenter && (
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(doc)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {previewDoc && (
        <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}

      <Dialog open={uploadOpen} onOpenChange={(open) => { setUploadOpen(open); if (!open) { setFile(null); setDocName(""); setCategory(""); setAgendaItemId("none"); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload dokument til møde</DialogTitle>
            <DialogDescription>Dokumentet tilknyttes dette møde og vises i dokumentarkivet.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => document.getElementById("meeting-file-input")?.click()}
            >
              <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              {file ? (
                <p className="text-sm font-medium">{file.name} ({formatBytes(file.size)})</p>
              ) : (
                <p className="text-sm text-muted-foreground">Klik for at vælge fil (maks 25 MB)</p>
              )}
              <input id="meeting-file-input" type="file" accept={ACCEPTED_TYPES} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
            </div>
            <div className="space-y-2">
              <Label>Dokumentnavn</Label>
              <Input value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="Navn" />
            </div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Vælg kategori" /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {agendaItems.length > 0 && (
              <div className="space-y-2">
                <Label>Tilknyt dagsordenspunkt (valgfrit)</Label>
                <Select value={agendaItemId} onValueChange={setAgendaItemId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ingen — fælles dokument</SelectItem>
                    {agendaItems.map((a) => <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleUpload} disabled={!file || !category || uploading}>
              {uploading ? "Uploader..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MeetingDocumentsTab;
