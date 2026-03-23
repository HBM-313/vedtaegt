// Generér iCal-streng for ét møde
// RFC 5545 kompatibelt format — virker i Outlook, Google Calendar, Apple Calendar

export interface ICalMeeting {
  id: string;
  title: string;
  meeting_date: string | null;
  location: string | null;
  orgName: string;
  description?: string;
}

function formatICalDate(iso: string): string {
  // YYYYMMDDTHHMMSSZ
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "").replace(/Z$/, "Z");
}

function escapeIcal(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function foldLine(line: string): string {
  // iCal kræver max 75 tegn per linje, fold med CRLF + whitespace
  const chunks: string[] = [];
  while (line.length > 75) {
    chunks.push(line.slice(0, 75));
    line = " " + line.slice(75);
  }
  chunks.push(line);
  return chunks.join("\r\n");
}

export function generateICalString(meetings: ICalMeeting[]): string {
  const now = formatICalDate(new Date().toISOString());

  const events = meetings
    .filter((m) => m.meeting_date)
    .map((m) => {
      const dtstart = formatICalDate(m.meeting_date!);
      // Standardmøde: 2 timer
      const endDate = new Date(m.meeting_date!);
      endDate.setHours(endDate.getHours() + 2);
      const dtend = formatICalDate(endDate.toISOString());

      const lines = [
        "BEGIN:VEVENT",
        `UID:${m.id}@vedtaegt.dk`,
        `DTSTAMP:${now}`,
        `DTSTART:${dtstart}`,
        `DTEND:${dtend}`,
        foldLine(`SUMMARY:${escapeIcal(m.title)}`),
        foldLine(`ORGANIZER;CN=${escapeIcal(m.orgName)}:mailto:noreply@vedtaegt.dk`),
      ];

      if (m.location) {
        lines.push(foldLine(`LOCATION:${escapeIcal(m.location)}`));
      }
      if (m.description) {
        lines.push(foldLine(`DESCRIPTION:${escapeIcal(m.description)}`));
      }

      lines.push("END:VEVENT");
      return lines.join("\r\n");
    });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Vedtægt//Vedtægt Platform//DA",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadICal(meetings: ICalMeeting[], filename = "moeder.ics"): void {
  const content = generateICalString(meetings);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
