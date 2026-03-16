import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileText, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Doc {
  id: string;
  name: string;
  storage_path: string;
  file_type?: string | null;
}

interface Props {
  doc: Doc;
  onClose: () => void;
}

const PREVIEWABLE_IMAGES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const PREVIEWABLE_PDF = "application/pdf";
const NON_PREVIEWABLE = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.ms-excel",
];

function getFileExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() || "";
}

function isImage(doc: Doc): boolean {
  if (doc.file_type && PREVIEWABLE_IMAGES.includes(doc.file_type)) return true;
  const ext = getFileExtension(doc.name);
  return ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
}

function isPdf(doc: Doc): boolean {
  if (doc.file_type === PREVIEWABLE_PDF) return true;
  return getFileExtension(doc.name) === "pdf";
}

function isNonPreviewable(doc: Doc): boolean {
  if (doc.file_type && NON_PREVIEWABLE.includes(doc.file_type)) return true;
  const ext = getFileExtension(doc.name);
  return ["docx", "xlsx", "doc", "xls"].includes(ext);
}

function getFileIcon(doc: Doc): string {
  const ext = getFileExtension(doc.name);
  if (["xlsx", "xls"].includes(ext)) return "📊";
  if (["docx", "doc"].includes(ext)) return "📄";
  return "📄";
}

const DocumentPreviewModal = ({ doc, onClose }: Props) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const getUrl = async () => {
      setLoading(true);
      setError(false);
      const { data, error: err } = await supabase.storage
        .from("documents")
        .createSignedUrl(doc.storage_path, 3600);
      if (err || !data?.signedUrl) {
        setError(true);
      } else {
        setSignedUrl(data.signedUrl);
      }
      setLoading(false);
    };
    getUrl();
  }, [doc.storage_path]);

  const handleDownload = async () => {
    const { data, error } = await supabase.storage.from("documents").download(doc.storage_path);
    if (error || !data) return;
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderContent = () => {
    if (loading) {
      return <Skeleton className="w-full h-96" />;
    }
    if (error || !signedUrl) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <FileText className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-sm">Kunne ikke indlæse filen.</p>
          <Button variant="outline" className="mt-4" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" /> Download for at åbne
          </Button>
        </div>
      );
    }

    if (isPdf(doc)) {
      return (
        <iframe
          src={`${signedUrl}#toolbar=1`}
          className="w-full h-[70vh] rounded-md border"
          title={doc.name}
        />
      );
    }

    if (isImage(doc)) {
      return (
        <div className="flex items-center justify-center max-h-[70vh] overflow-auto">
          <img
            src={signedUrl}
            alt={doc.name}
            className="max-w-full max-h-[70vh] object-contain rounded-md"
          />
        </div>
      );
    }

    if (isNonPreviewable(doc)) {
      const ext = getFileExtension(doc.name);
      const typeLabel = ["xlsx", "xls"].includes(ext) ? "Excel" : "Word";
      return (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <span className="text-5xl mb-4">{getFileIcon(doc)}</span>
          <p className="text-lg font-medium text-foreground">{doc.name}</p>
          <p className="text-sm mt-2">
            Forhåndsvisning er ikke tilgængelig for {typeLabel}-filer.
          </p>
          <Button className="mt-6" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" /> Download for at åbne
          </Button>
        </div>
      );
    }

    // Fallback for unknown types
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <FileText className="h-12 w-12 mb-3 opacity-40" />
        <p className="text-lg font-medium text-foreground">{doc.name}</p>
        <p className="text-sm mt-2">Forhåndsvisning er ikke tilgængelig for denne filtype.</p>
        <Button className="mt-6" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-2" /> Download for at åbne
        </Button>
      </div>
    );
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-base truncate pr-8">{doc.name}</DialogTitle>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
};

export default DocumentPreviewModal;
