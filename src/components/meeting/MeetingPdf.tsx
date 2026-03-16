import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, Font } from "@react-pdf/renderer";
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
  approval: { fontSize: 9, marginBottom: 3 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 7, color: "#999", borderTopWidth: 1, borderTopColor: "#eee", paddingTop: 6 },
});

interface Meeting {
  id: string;
  title: string;
  meeting_date: string | null;
  location: string | null;
  approved_at: string | null;
}

interface Props {
  meeting: Meeting;
  orgName: string;
  onClose: () => void;
}

interface PdfData {
  agendaItems: { title: string; description: string | null; sort_order: number | null }[];
  minutesContent: Record<string, string>;
  actionItems: { title: string; assignee: string; due_date: string | null }[];
  participants: { name: string; role: string }[];
  approvals: { name: string; approved_at: string | null }[];
}

const MeetingPdf = ({ meeting, orgName, onClose }: Props) => {
  const [data, setData] = useState<PdfData | null>(null);

  useEffect(() => {
    const load = async () => {
      const [agendaRes, minutesRes, actionsRes, approvalsRes] = await Promise.all([
        supabase
          .from("agenda_items")
          .select("title, description, sort_order")
          .eq("meeting_id", meeting.id)
          .order("sort_order", { ascending: true }),
        supabase
          .from("minutes")
          .select("content")
          .eq("meeting_id", meeting.id)
          .maybeSingle(),
        supabase
          .from("action_items")
          .select("title, due_date, members!action_items_assigned_to_fkey(name)")
          .eq("meeting_id", meeting.id),
        supabase
          .from("approvals")
          .select("approved_at, members!approvals_member_id_fkey(name, role)")
          .eq("meeting_id", meeting.id),
      ]);

      let mc: Record<string, string> = {};
      if (minutesRes.data?.content) {
        try { mc = JSON.parse(minutesRes.data.content); } catch {}
      }

      setData({
        agendaItems: (agendaRes.data || []) as any,
        minutesContent: mc,
        actionItems: (actionsRes.data || []).map((a: any) => ({
          title: a.title,
          assignee: a.members?.name || "Ikke tildelt",
          due_date: a.due_date,
        })),
        participants: (approvalsRes.data || []).map((a: any) => ({
          name: a.members?.name || "Ukendt",
          role: a.members?.role || "",
        })),
        approvals: (approvalsRes.data || []).map((a: any) => ({
          name: a.members?.name || "Ukendt",
          approved_at: a.approved_at,
        })),
      });
    };
    load();
  }, [meeting.id]);

  const formatDanishDate = (d: string | null) => {
    if (!d) return "";
    return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "long", year: "numeric" }).format(new Date(d));
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

        {/* Participants */}
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

        {/* Agenda + Minutes */}
        <View>
          <Text style={styles.sectionTitle}>Dagsorden og referat</Text>
          {data!.agendaItems.map((item, i) => (
            <View key={i} style={styles.agendaItem}>
              <Text style={styles.agendaTitle}>
                {i + 1}. {item.title}
              </Text>
              {data!.minutesContent[item.title] || data!.minutesContent[Object.keys(data!.minutesContent)[i]] ? (
                <Text style={styles.agendaContent}>
                  {data!.minutesContent[Object.keys(data!.minutesContent)[i]] || ""}
                </Text>
              ) : null}
            </View>
          ))}
        </View>

        {/* Action items */}
        {data!.actionItems.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Handlingspunkter</Text>
            {data!.actionItems.map((a, i) => (
              <View key={i} style={styles.actionItem}>
                <Text style={styles.actionTitle}>{a.title}</Text>
                <Text style={styles.actionMeta}>
                  Ansvarlig: {a.assignee}
                  {a.due_date ? ` · Frist: ${formatDanishDate(a.due_date)}` : ""}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Approvals */}
        {data!.approvals.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Godkendelser</Text>
            {data!.approvals.map((a, i) => (
              <Text key={i} style={styles.approval}>
                {a.name} — {a.approved_at ? formatDanishDate(a.approved_at) : "Afventer"}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.footer}>
          <Text>Genereret af Vedtægt · {formatDanishDate(new Date().toISOString())}</Text>
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
