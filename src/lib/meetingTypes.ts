// Møde-type definitioner og hjælpefunktioner

export type MeetingType =
  | "bestyrelsesoede"
  | "ordinaer_generalforsamling"
  | "ekstraordinaer_generalforsamling";

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  bestyrelsesoede: "Bestyrelsesmøde",
  ordinaer_generalforsamling: "Ordinær generalforsamling",
  ekstraordinaer_generalforsamling: "Ekstraordinær generalforsamling",
};

export const MEETING_TYPE_SHORT: Record<MeetingType, string> = {
  bestyrelsesoede: "Bestyrelsesmøde",
  ordinaer_generalforsamling: "Ordinær GF",
  ekstraordinaer_generalforsamling: "Ekstraordinær GF",
};

export const MEETING_TYPE_OPTIONS: { value: MeetingType; label: string; description: string }[] = [
  {
    value: "bestyrelsesoede",
    label: "Bestyrelsesmøde",
    description: "Ordinært møde i bestyrelsen",
  },
  {
    value: "ordinaer_generalforsamling",
    label: "Ordinær generalforsamling",
    description: "Årlig GF — afholdes én gang om året",
  },
  {
    value: "ekstraordinaer_generalforsamling",
    label: "Ekstraordinær generalforsamling",
    description: "Indkaldes ved særlige behov",
  },
];

// Standard dagsordenspunkter for generalforsamling
export const GF_STANDARD_AGENDA: string[] = [
  "Valg af dirigent",
  "Bestyrelsens beretning",
  "Fremlæggelse og godkendelse af regnskab",
  "Behandling af indkomne forslag",
  "Fastsættelse af kontingent og budget",
  "Valg til bestyrelsen",
  "Eventuelt",
];

export function getMeetingTypeLabel(type: string): string {
  return MEETING_TYPE_LABELS[type as MeetingType] ?? MEETING_TYPE_LABELS.bestyrelsesoede;
}

export function getMeetingTypeShort(type: string): string {
  return MEETING_TYPE_SHORT[type as MeetingType] ?? MEETING_TYPE_SHORT.bestyrelsesoede;
}

export function isGeneralforsamling(type: string): boolean {
  return (
    type === "ordinaer_generalforsamling" ||
    type === "ekstraordinaer_generalforsamling"
  );
}
