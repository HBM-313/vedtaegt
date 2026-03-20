// Rolle-typer og hjælpefunktioner for Vedtægt
// Bemærk: Selve tilladelserne styres i databasens role_permissions-tabel,
// ikke her. Denne fil indeholder kun labels, sortering og lister.

export type DanishRole =
  | "formand"
  | "naestformand"
  | "kasserer"
  | "bestyrelsesmedlem"
  | "suppleant";

export const ROLE_LABELS: Record<DanishRole, string> = {
  formand: "Formand",
  naestformand: "Næstformand",
  kasserer: "Kasserer",
  bestyrelsesmedlem: "Bestyrelsesmedlem",
  suppleant: "Suppleant",
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
  return ROLE_LABELS[role as DanishRole] || role;
}
