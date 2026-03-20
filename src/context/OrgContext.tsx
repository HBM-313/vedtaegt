import { createContext, useContext } from "react";

export interface RolePermission {
  kan_oprette_moeder: boolean;
  kan_redigere_moeder: boolean;
  kan_sende_til_godkendelse: boolean;
  kan_godkende_referat: boolean;
  kan_se_dokumenter: boolean;
  kan_uploade_dokumenter: boolean;
  kan_slette_dokumenter: boolean;
  kan_lukke_andres_handlingspunkter: boolean;
  kan_invitere_medlemmer: boolean;
  kan_fjerne_medlemmer: boolean;
  kan_aendre_roller: boolean;
  kan_se_indstillinger: boolean;
  kan_redigere_forening: boolean;
  arver_formand_ved_fravaer: boolean;
}

export interface OrgMember {
  id: string;
  role: string;
  er_fravaerende: boolean;
  name: string;
}

export interface OrgContextType {
  orgId: string | null;
  orgName: string | null;
  memberId: string | null;
  memberName: string | null;
  memberRole: string | null;
  userId: string | null;
  rolePermissions: Record<string, RolePermission> | null;
  members: OrgMember[] | null;
  refetchPermissions: () => void;
}

export const OrgContext = createContext<OrgContextType>({
  orgId: null,
  orgName: null,
  memberId: null,
  memberName: null,
  memberRole: null,
  userId: null,
  rolePermissions: null,
  members: null,
  refetchPermissions: () => {},
});

export const useOrg = () => useContext(OrgContext);
