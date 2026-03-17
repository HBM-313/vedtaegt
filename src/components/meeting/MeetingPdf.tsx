import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink } from "@react-pdf/renderer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { getRoleLabel } from "@/lib/roles";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" },
  header: { marginBottom: 20 },
  orgName: { fontSize: 14, fontWeight: "bold", marginBottom: 4 },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  meta: { fontSize: 9, color: "#666", marginBottom: 20 },
  sectionTitle: { fontSize: 12, fontWeight: "bold", marginBottom: 8, marginTop: 16, borderBottomWidth: 1, borderBottomColor: "#ddd", paddingBottom: 4 },
  agendaItem: { marginBottom: 12 },
  agendaTitle: { fontSize: 10, fontWeight: "bold", marginBottom: 2 },
  agendaContent: { fontSize: 9, color: "#333", lineHeight: 1.5 },
  actionItem: { marginBottom: 6, paddingLeft: 10 },
  actionTitle: { fontSize: 9, fontWeight: "bold" },
  actionMeta: { fontSize: 8, color: "#666" },
  participant: { fontSize: 9, marginBottom: 3 },
  approvalEntry: { marginBottom: 8 },
  approvalName: { fontSize: 9, fontWeight: "bold" },
  approvalDate: { fontSize: 8, color: "#666" },
  approvalSummary: { fontSize: 9, color: "#333", marginTop: 8, borderTopWidth: 1, borderTopColor: "#ddd", paddingTop: 6 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 7, color: "#999", borderTopWidth: 1, borderTopColor: "#eee", paddingTop: 6 },
  separator: { borderBottomWidth: 1, borderBottomColor: "#ddd", marginBottom: 8, marginTop: 4 },
});

interface Meeting {
  id: string; title: string; meeting_date: string | null;
  location: string | null; approved_at: string | null;
  godkendelse_runde?: number | null;
}

interface Props {
  meeting: Meeting;
  orgName: string;
  onClose: () => void;
}

interface AgendaItem {
  id: string;
  title: string;
  description: string | null;
  sort_order: number | null;
}

interface PdfData {
  agendaItems: AgendaItem[];
  minutesContent: Record<string, string>;
  actionItems: { title: string; assignee: string; due_date: string | null }[];
  participants: { name: string; role: string }[];
  approvals: { name: string; role: string; approved_at: string | null }[];
  documents: { name: string; category: string | null; uploader: string; created_at: string | null; agenda_item_title: string | null }[];
}

const MeetingPdf = ({ meeting, orgName, onClose }: Props) => {
  const [data, setData] = useState<PdfData | null>(null);

  useEffect(() => {
    const load = async () => {
      const [agendaRes, minutesRes, actionsRes, approvalsRes, docsRes] = await Promise.all([
        supabase.from("agenda_items").select("id, title, description, sort_order").eq("meeting_id", meeting.id).order("sort_order", { ascending: true }),
        supabase.from("minutes").select("content").eq("meeting_id", meeting.id).maybeSingle(),
        supabase.from("action_items").select("title, due_date, members!action_items_assigned_to_fkey(name)").eq("meeting_id", meeting.id),
        supabase.from("approvals").select("approved_at, status, members!approvals_member_id_fkey(name, role)").eq("meeting_id", meeting.id).eq("status", "godkendt"),
        supabase.from("documents").select("name, category, created_at, uploaded_by, agenda_item_id, members!documents_uploaded_by_fkey(name), agenda_items!documents_agenda_item_id_fkey(title)").eq("meeting_id", meeting.id),
      ]);

      let mc: Record<string, string> = {};
      if (minutesRes.data?.content) {
        try { mc = JSON.parse(minutesRes.data.content); } catch {}
      }

      const approvalData = (approvalsRes.data || []) as any[];
      const docsData = (docsRes.data || []) as any[];
      setData({
        agendaItems: (agendaRes.data || []) as AgendaItem[],
        minutesContent: mc,
        actionItems: (actionsRes.data || []).map((a: any) => ({
          title: a.title,
          assignee: a.members?.name || "Ikke tildelt",
          due_date: a.due_date,
        })),
        participants: approvalData.map((a) => ({
          name: a.members?.name || "Ukendt",
          role: a.members?.role || "",
        })),
        approvals: approvalData.map((a) => ({
          name: a.members?.name || "Ukendt",
          role: a.members?.role || "",
          approved_at: a.approved_at,
        })),
        documents: docsData.map((d: any) => ({
          name: d.name,
          category: d.category,
          uploader: d.members?.name || "Ukendt",
          created_at: d.created_at,
          agenda_item_title: d.agenda_items?.title || null,
        })),
      });
    };
    load();
  }, [meeting.id]);

  const formatDanishDate = (d: string | null) => {
    if (!d) return "";
    return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "long", year: "numeric" }).format(new Date(d));
  };

  const formatDanishDateTime = (d: string | null) => {
    if (!d) return "";
    return new Intl.DateTimeFormat("da-DK", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(d));
  };

  const PdfDoc = () => (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.orgName}>{orgName}</Text>
          <Text style={styles.title}>{meeting.title}</Text>
          <Text style={styles.meta}>
            {meeting.meeting_date ? formatDanishDate(meeting.meeting_date) : ""}
            {meeting.location ? ` · ${meeting.location}` : ""}
          </Text>
        </View>

        {data!.participants.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Deltagere</Text>
            {data!.participants.map((p, i) => (
              <Text key={i} style={styles.participant}>
                {p.name} ({getRoleLabel(p.role)})
              </Text>
            ))}
          </View>
        )}

        <View>
          <Text style={styles.sectionTitle}>Dagsorden og referat</Text>
          {data!.agendaItems.map((item, i) => {
            // Map minutes by agenda_item.id instead of index
            const minuteText = data!.minutesContent[item.id] || "";
            return (
              <View key={item.id} style={styles.agendaItem}>
                <Text style={styles.agendaTitle}>{i + 1}. {item.title}</Text>
                {minuteText ? (
                  <Text style={styles.agendaContent}>{minuteText}</Text>
                ) : null}
              </View>
            );
          })}
        </View>

        {data!.actionItems.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Handlingspunkter</Text>
            {data!.actionItems.map((a, i) => (
              <View key={i} style={styles.actionItem}>
                <Text style={styles.actionTitle}>{a.title}</Text>
                <Text style={styles.actionMeta}>
                  Ansvarlig: {a.assignee}{a.due_date ? ` · Frist: ${formatDanishDate(a.due_date)}` : ""}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Bilag section */}
        {data!.documents.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Bilag</Text>
            {data!.documents.filter(d => !d.agenda_item_title).length > 0 && (
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 9, fontWeight: "bold", marginBottom: 4 }}>Fælles dokumenter:</Text>
                {data!.documents.filter(d => !d.agenda_item_title).map((d, i) => (
                  <View key={i} style={styles.actionItem}>
                    <Text style={styles.actionTitle}>{i + 1}. {d.name}{d.category ? ` (${d.category})` : ""}</Text>
                    <Text style={styles.actionMeta}>Uploadet af: {d.uploader}{d.created_at ? ` · ${formatDanishDate(d.created_at)}` : ""}</Text>
                  </View>
                ))}
              </View>
            )}
            {data!.documents.filter(d => d.agenda_item_title).length > 0 && (
              <View>
                {data!.documents.filter(d => d.agenda_item_title).map((d, i) => (
                  <View key={i} style={styles.actionItem}>
                    <Text style={{ fontSize: 9, fontWeight: "bold", marginBottom: 2 }}>Tilknyttet: {d.agenda_item_title}</Text>
                    <Text style={styles.actionTitle}>{d.name}{d.category ? ` (${d.category})` : ""}</Text>
                    <Text style={styles.actionMeta}>Uploadet af: {d.uploader}{d.created_at ? ` · ${formatDanishDate(d.created_at)}` : ""}</Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={{ fontSize: 8, color: "#666", marginTop: 4 }}>Dokumenterne kan tilgås via Vedtægt-platformen.</Text>
          </View>
        )}

        {/* Godkendelser section */}
        {data!.approvals.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Godkendelser</Text>
            <View style={styles.separator} />
            {data!.approvals.map((a, i) => (
              <View key={i} style={styles.approvalEntry}>
                <Text style={styles.approvalName}>{a.name} ({getRoleLabel(a.role)})</Text>
                <Text style={styles.approvalDate}>
                  Godkendt: {a.approved_at ? formatDanishDateTime(a.approved_at) : "Afventer"}
                </Text>
              </View>
            ))}
            <View style={styles.approvalSummary}>
              <Text>Godkendelsesrunde: {meeting.godkendelse_runde || 1}</Text>
              <Text>Endeligt godkendt: {meeting.approved_at ? formatDanishDateTime(meeting.approved_at) : ""}</Text>
            </View>
          </View>
        )}

        <View style={styles.footer}>
          <Text>Genereret af Vedtægt · vedtægt.dk</Text>
        </View>
      </Page>
    </Document>
  );

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Download referat som PDF</DialogTitle>
        </DialogHeader>
        {!data ? (
          <p className="text-sm text-muted-foreground">Forbereder PDF...</p>
        ) : (
          <PDFDownloadLink
            document={<PdfDoc />}
            fileName={`${meeting.title.replace(/\s+/g, "_")}_referat.pdf`}
          >
            {({ loading: pdfLoading }) => (
              <Button className="w-full press-effect" disabled={pdfLoading}>
                <Download className="h-4 w-4 mr-2" />
                {pdfLoading ? "Genererer PDF..." : "Download PDF"}
              </Button>
            )}
          </PDFDownloadLink>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MeetingPdf;
