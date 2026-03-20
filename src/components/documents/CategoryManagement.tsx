import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/context/OrgContext";
import { logAuditEvent } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GripVertical, Lock, Plus, Trash2, FolderOpen } from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  label: string;
  retention_years: number | null;
  er_aktiv: boolean;
  er_laast: boolean;
  sort_order: number;
}

const CategoryManagement = () => {
  const { orgId } = useOrg();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const fetchCategories = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from("document_categories")
      .select("*")
      .eq("org_id", orgId)
      .order("sort_order", { ascending: true });
    setCategories((data || []) as Category[]);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const handleCreate = async () => {
    if (!orgId || !newName.trim()) return;
    setCreating(true);
    const slug = newName.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_æøå]/g, "");
    const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.sort_order)) + 1 : 0;
    const { error } = await supabase.from("document_categories").insert({
      org_id: orgId,
      name: slug,
      label: newName.trim(),
      sort_order: maxOrder,
    } as any);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "En kategori med det navn eksisterer allerede." : "Kunne ikke oprette kategori.");
    } else {
      await logAuditEvent("document_category.created", "document_category", orgId, { name: newName.trim() });
      toast.success("Kategori oprettet.");
      setNewName("");
      fetchCategories();
    }
    setCreating(false);
  };

  const handleToggle = async (cat: Category) => {
    if (cat.er_laast) return;
    const { error } = await supabase
      .from("document_categories")
      .update({ er_aktiv: !cat.er_aktiv } as any)
      .eq("id", cat.id);
    if (error) { toast.error("Kunne ikke opdatere kategori."); return; }
    setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, er_aktiv: !c.er_aktiv } : c));
  };

  const handleDeleteClick = async (cat: Category) => {
    if (cat.er_laast) return;
    if (!orgId) return;
    const { count } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("category", cat.name);
    if (count && count > 0) {
      setDeleteError(`Denne kategori bruges af ${count} dokumenter og kan ikke slettes. Slå den fra i stedet.`);
      setDeleteTarget(null);
    } else {
      setDeleteError(null);
      setDeleteTarget(cat);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await supabase.from("document_categories").delete().eq("id", deleteTarget.id);
    await logAuditEvent("document_category.deleted", "document_category", deleteTarget.id, { name: deleteTarget.label });
    toast.success("Kategori slettet.");
    setDeleteTarget(null);
    fetchCategories();
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);

  const handleDrop = async (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) { setDragIdx(null); return; }
    const reordered = [...categories];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    setCategories(reordered);
    setDragIdx(null);

    // Save new sort_order
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].sort_order !== i) {
        await supabase.from("document_categories").update({ sort_order: i } as any).eq("id", reordered[i].id);
      }
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FolderOpen className="h-5 w-5" /> Dokumentkategorier
        </CardTitle>
        <CardDescription>Administrér kategorier for dokumentarkivet.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {deleteError && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 text-sm text-destructive">
            {deleteError}
            <Button variant="ghost" size="sm" className="ml-2" onClick={() => setDeleteError(null)}>OK</Button>
          </div>
        )}

        <div className="space-y-1">
          {categories.map((cat, idx) => (
            <div
              key={cat.id}
              className="flex items-center gap-3 px-3 py-2 rounded-md border border-border bg-card hover:bg-muted/50 transition-colors"
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(idx)}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
              <span className="flex-1 text-sm font-medium">{cat.label}</span>
              <span className="text-xs text-muted-foreground">{cat.retention_years} år</span>
              {cat.er_laast ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2">
                      <Switch checked={cat.er_aktiv} disabled />
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Regnskabskategorien er påkrævet jf. Bogføringsloven.</TooltipContent>
                </Tooltip>
              ) : (
                <>
                  <Switch checked={cat.er_aktiv} onCheckedChange={() => handleToggle(cat)} />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteClick(cat)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Nyt kategorinavn"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
          />
          <Button onClick={handleCreate} disabled={!newName.trim() || creating} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Opret
          </Button>
        </div>

        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Slet kategori</AlertDialogTitle>
              <AlertDialogDescription>
                Er du sikker på, at du vil slette kategorien "{deleteTarget?.label}"?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annullér</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Slet
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

export default CategoryManagement;
