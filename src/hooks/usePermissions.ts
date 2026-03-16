import { useOrg } from "@/components/AppLayout";

export interface Permissions {
  kanOpretteMoeder: boolean;
  kanRedigereMoeder: boolean;
  kanSendeTilGodkendelse: boolean;
  kanGodkendeReferat: boolean;
  kanUploadeDokumenter: boolean;
  kanSletteDokumenter: boolean;
  kanLukkeAndresHandlingspunkter: boolean;
  kanInvitereMedlemmer: boolean;
  kanFjerneMedlemmer: boolean;
  kanAendreRoller: boolean;
  kanSeIndstillinger: boolean;
  kanRedigereForening: boolean;
  erFormand: boolean;
  erNaestformand: boolean;
  aktuelRolle: string;
  loaded: boolean;
}

const DEFAULT_PERMS: Permissions = {
  kanOpretteMoeder: false,
  kanRedigereMoeder: false,
  kanSendeTilGodkendelse: false,
  kanGodkendeReferat: true,
  kanUploadeDokumenter: false,
  kanSletteDokumenter: false,
  kanLukkeAndresHandlingspunkter: false,
  kanInvitereMedlemmer: false,
  kanFjerneMedlemmer: false,
  kanAendreRoller: false,
  kanSeIndstillinger: false,
  kanRedigereForening: false,
  erFormand: false,
  erNaestformand: false,
  aktuelRolle: "",
  loaded: false,
};

export function usePermissions(): Permissions {
  const { memberRole, rolePermissions, members } = useOrg();

  if (!memberRole || !rolePermissions) return DEFAULT_PERMS;

  let perms = rolePermissions[memberRole];

  // Næstformand-vikariat: if formand is absent, næstformand inherits formand permissions
  if (memberRole === "naestformand" && perms?.arver_formand_ved_fravaer) {
    const formand = members?.find((m) => m.role === "formand");
    if (formand?.er_fravaerende) {
      perms = rolePermissions["formand"] || perms;
    }
  }

  return {
    kanOpretteMoeder: perms?.kan_oprette_moeder ?? false,
    kanRedigereMoeder: perms?.kan_redigere_moeder ?? false,
    kanSendeTilGodkendelse: perms?.kan_sende_til_godkendelse ?? false,
    kanGodkendeReferat: perms?.kan_godkende_referat ?? true,
    kanUploadeDokumenter: perms?.kan_uploade_dokumenter ?? false,
    kanSletteDokumenter: perms?.kan_slette_dokumenter ?? false,
    kanLukkeAndresHandlingspunkter: perms?.kan_lukke_andres_handlingspunkter ?? false,
    kanInvitereMedlemmer: perms?.kan_invitere_medlemmer ?? false,
    kanFjerneMedlemmer: perms?.kan_fjerne_medlemmer ?? false,
    kanAendreRoller: perms?.kan_aendre_roller ?? false,
    kanSeIndstillinger: perms?.kan_se_indstillinger ?? false,
    kanRedigereForening: perms?.kan_redigere_forening ?? false,
    erFormand: memberRole === "formand",
    erNaestformand: memberRole === "naestformand",
    aktuelRolle: memberRole,
    loaded: true,
  };
}
