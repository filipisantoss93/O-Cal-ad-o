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
    };
  };
};
