import type { Database } from "@/types/database";

/** RPCs administrativos adicionados após a geração do tipo global do banco. */
export type AdminOwnerCandidate = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone_e164: string | null;
  used_businesses: number;
  allowed_businesses: number;
};

export type AdminBusinessOwnerTransferHistory = {
  transfer_id: number;
  business_id: number;
  previous_owner_id: string;
  new_owner_id: string;
  previous_owner_name: string | null;
  previous_owner_email: string | null;
  new_owner_name: string | null;
  new_owner_email: string | null;
  reason: string;
  created_at: string;
};

export type DatabaseWithAdminOwnerLink = Database & {
  public: {
    Functions: {
      admin_search_business_owner_candidates: {
        Args: { p_query: string; p_limit?: number };
        Returns: AdminOwnerCandidate[];
      };
      admin_link_unclaimed_business: {
        Args: { p_business_id: number; p_user_id: string };
        Returns: undefined;
      };
      admin_transfer_business_owner: {
        Args: {
          p_business_id: number;
          p_new_owner_id: string;
          p_reason: string;
          p_confirmation: string;
        };
        Returns: number;
      };
      admin_business_owner_transfer_history: {
        Args: { p_business_id: number; p_limit?: number };
        Returns: AdminBusinessOwnerTransferHistory[];
      };
    };
  };
};
