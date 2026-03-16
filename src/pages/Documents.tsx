import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/components/AppLayout";
import { logAuditEvent } from "@/lib/audit";
import { formatShortDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Upload, Search, Download, Trash2, Lock, Plus, FileText } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "referat", label: "Referat", retention: 10, color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "regnskab", label: "Regnskab", retention: 5, color: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "vedtaegt", label: "Vedtægt", retention: 10, color: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "forsikring", label: "Forsikring", retention: 10, color: "bg-green-100 text-green-800 border-green-200" },
  { value: "other", label: "Øvrige", retention: 3, color: "bg-muted text-muted-foreground border-border" },
] as const;

type CategoryValue = typeof CATEGORIES[number]["value"];

const getCategoryMeta = (cat: string | null) =>
  CATEGORIES.find((c) => c.value === cat) ?? CATEGORIES[4];

interface Doc {
  id: string;
  name: string;
  category: string | null;
  created_at: string | null;
  file_size_bytes: number | null;
  storage_path: string;
  uploaded_by: string | null;
  uploader_name?: string;
}

const formatBytes = (bytes: number | null) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const Documents = () => {
  const { orgId, memberId } = useOrg();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteDoc, setDeleteDoc] = useState<Doc | null>(null);

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [docName, setDocName] = useState("");
  const [category, setCategory] = useState<CategoryValue | "">("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const fetchDocs = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const { data } = await supabase
      .from("documents")
      .select("id, name, category, created_at, file_size_bytes, storage_path, uploaded_by")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (data) {
      // Fetch uploader names
      const uploaderIds = [...new Set(data.map((d) => d.uploaded_by).filter(Boolean))] as string[];
      let memberMap: Record<string, string> = {};
      if (uploaderIds.length > 0) {
        const { data: members } = await supabase
          .from("members")
          .select("id, name")
          .in("id", uploaderIds);
        if (members) {
          memberMap = Object.fromEntries(members.map((m) => [m.id, m.name]));
        }
      }
      setDocs(data.map((d) => ({ ...d, uploader_name: d.uploaded_by ? memberMap[d.uploaded_by] : undefined })));
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const filtered = useMemo(() => {
    let result = docs;
    if (filterCat !== "all") result = result.filter((d) => d.category === filterCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((d) => d.name.toLowerCase().includes(q));
    }
    return result;
  }, [docs, filterCat, search]);

  const selectedCatMeta = category ? getCategoryMeta(category) : null;

  const handleFileSelect = (f: File) => {
    setFile(f);
    if (!docName) setDocName(f.name.replace(/\.[^.]+$/, ""));
  };

  const handleUpload = async () => {
    if (!file || !category || !orgId || !memberId) return;
    setUploading(true);

    const uuid = crypto.randomUUID();
    const storagePath = `${orgId}/${uuid}/${file.name}`;

    const { error: storageError } = await supabase.storage
      .from("documents")
      .upload(storagePath, file);

    if (storageError) {
      toast.error("Upload fejlede: " + storageError.message);
      setUploading(false);
      return;
    }

    const retention = getCategoryMeta(category).retention;

    const { error: dbError } = await supabase.from("documents").insert({
      org_id: orgId,
      name: docName || file.name,
      category,
      storage_path: storagePath,
      file_size_bytes: file.size,
      file_type: file.type,
      uploaded_by: memberId,
      retention_years: retention,
    });

    if (dbError) {
      toast.error("Kunne ikke gemme dokument.");
      setUploading(false);
      return;
    }

    await logAuditEvent("document.uploaded", "document", uuid, { name: docName || file.name, category });

    toast.success("Dokument uploadet!");
    setUploadOpen(false);
    setFile(null);
    setDocName("");
    setCategory("");
    setUploading(false);
    fetchDocs();
  };

  const handleDownload = async (doc: Doc) => {
    const { data, error } = await supabase.storage
      .from("documents")
      .download(doc.storage_path);

    if (error || !data) {
      toast.error("Kunne ikke downloade filen.");
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    if (!deleteDoc) return;

    await supabase.storage.from("documents").remove([deleteDoc.storage_path]);
    await supabase.from("documents").delete().eq("id", deleteDoc.id);
    await logAuditEvent("document.deleted", "document", deleteDoc.id, { name: deleteDoc.name });

    toast.success("Dokument slettet.");
    setDeleteDoc(null);
    fetchDocs();
  };

  const filterTabs = [
    { value: "all", label: "Alle" },
    ...CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-semibold text-foreground">Dokumentarkiv</h1>
        <Button onClick={() => setUploadOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Upload dokument
        </Button>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Søg i dokumenter..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {filterTabs.map((t) => (
            <Button
              key={t.value}
              variant={filterCat === t.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterCat(t.value)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FolderOpenIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">Ingen dokumenter endnu</p>
          <p className="text-sm mt-1">Upload dit første dokument for at komme i gang.</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Navn</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead className="hidden md:table-cell">Uploadet af</TableHead>
                <TableHead className="hidden sm:table-cell">Dato</TableHead>
                <TableHead className="hidden sm:table-cell">Størrelse</TableHead>
                <TableHead className="text-right">Handlinger</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((doc) => {
                const meta = getCategoryMeta(doc.category);
                const isRegnskab = doc.category === "regnskab";
                return (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate max-w-[200px]">{doc.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={meta.color}>
                        {meta.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {doc.uploader_name || "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {doc.created_at ? formatShortDate(doc.created_at) : "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground tabular-nums">
                      {formatBytes(doc.file_size_bytes)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleDownload(doc)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        {isRegnskab ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" disabled className="opacity-50">
                                <Lock className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Regnskabsdokumenter opbevares i 5 år jf. Bogføringsloven og kan ikke slettes manuelt.
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Button variant="ghost" size="icon" onClick={() => setDeleteDoc(doc)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={(open) => { setUploadOpen(open); if (!open) { setFile(null); setDocName(""); setCategory(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload dokument</DialogTitle>
            <DialogDescription>Vælg en fil og angiv kategori.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Drag & drop */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) handleFileSelect(f);
              }}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              {file ? (
                <p className="text-sm font-medium text-foreground">{file.name} ({formatBytes(file.size)})</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">Træk fil hertil eller klik for at vælge</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, Word, Excel, billeder m.m.</p>
                </>
              )}
              <input
                id="file-input"
                type="file"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
              />
            </div>

            {/* Document name */}
            <div className="space-y-2">
              <Label htmlFor="doc-name">Dokumentnavn</Label>
              <Input
                id="doc-name"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                placeholder="Navn på dokumentet"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as CategoryValue)}>
                <SelectTrigger>
                  <SelectValue placeholder="Vælg kategori" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCatMeta && (
                <p className="text-xs text-muted-foreground">
                  Opbevaringsperiode: {selectedCatMeta.retention} år
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handleUpload}
              disabled={!file || !category || uploading}
            >
              {uploading ? "Uploader..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteDoc} onOpenChange={(open) => { if (!open) setDeleteDoc(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet dokument</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på, at du vil slette "{deleteDoc?.name}"? Denne handling kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Slet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Simple empty-state icon
const FolderOpenIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 14l1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2" />
  </svg>
);

export default Documents;
