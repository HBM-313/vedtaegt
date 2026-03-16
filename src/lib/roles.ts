export type DanishRole = "formand" | "naestformand" | "kasserer" | "bestyrelsesmedlem" | "suppleant";

export interface RolePermissions {
  label: string;
  kanOpretteMoeder: boolean;
  kanRedigereMoeder: boolean;
  kanSendeTilGodkendelse: boolean;
  kanInvitereMedlemmer: boolean;
  kanFjerneMedlemmer: boolean;
  kanAendreRoller: boolean;
  kanOpdatereForening: boolean;
  kanSeIndstillinger: boolean;
  kanOverdrageEjerskab: boolean;
  maxAntal: number | null;
}

export const ROLE_PERMISSIONS: Record<DanishRole, RolePermissions> = {
  formand: {
    label: "Formand",
    kanOpretteMoeder: true,
    kanRedigereMoeder: true,
    kanSendeTilGodkendelse: true,
    kanInvitereMedlemmer: true,
    kanFjerneMedlemmer: true,
    kanAendreRoller: true,
    kanOpdatereForening: true,
    kanSeIndstillinger: true,
    kanOverdrageEjerskab: true,
    maxAntal: 1,
  },
  naestformand: {
    label: "Næstformand",
    kanOpretteMoeder: true,
    kanRedigereMoeder: true,
    kanSendeTilGodkendelse: true,
    kanInvitereMedlemmer: true,
    kanFjerneMedlemmer: false,
    kanAendreRoller: false,
    kanOpdatereForening: false,
    kanSeIndstillinger: true,
    kanOverdrageEjerskab: false,
    maxAntal: 1,
  },
  kasserer: {
    label: "Kasserer",
    kanOpretteMoeder: true,
    kanRedigereMoeder: true,
    kanSendeTilGodkendelse: false,
    kanInvitereMedlemmer: false,
    kanFjerneMedlemmer: false,
    kanAendreRoller: false,
    kanOpdatereForening: false,
    kanSeIndstillinger: true,
    kanOverdrageEjerskab: false,
    maxAntal: 1,
  },
  bestyrelsesmedlem: {
    label: "Bestyrelsesmedlem",
    kanOpretteMoeder: false,
    kanRedigereMoeder: false,
    kanSendeTilGodkendelse: false,
    kanInvitereMedlemmer: false,
    kanFjerneMedlemmer: false,
    kanAendreRoller: false,
    kanOpdatereForening: false,
    kanSeIndstillinger: false,
    kanOverdrageEjerskab: false,
    maxAntal: null,
  },
  suppleant: {
    label: "Suppleant",
    kanOpretteMoeder: false,
    kanRedigereMoeder: false,
    kanSendeTilGodkendelse: false,
    kanInvitereMedlemmer: false,
    kanFjerneMedlemmer: false,
    kanAendreRoller: false,
    kanOpdatereForening: false,
    kanSeIndstillinger: false,
    kanOverdrageEjerskab: false,
    maxAntal: null,
  },
};

export const ROLE_SORT_ORDER: Record<DanishRole, number> = {
  formand: 0,
  naestformand: 1,
  kasserer: 2,
  bestyrelsesmedlem: 3,
  suppleant: 4,
};

export const INVITABLE_ROLES: DanishRole[] = [
  "naestformand",
  "kasserer",
  "bestyrelsesmedlem",
  "suppleant",
];

export function getRoleLabel(role: string): string {
  return ROLE_PERMISSIONS[role as DanishRole]?.label || role;
}

export function getRolePermissions(role: string | null): RolePermissions {
  if (!role) return ROLE_PERMISSIONS.suppleant;
  return ROLE_PERMISSIONS[role as DanishRole] || ROLE_PERMISSIONS.suppleant;
}
