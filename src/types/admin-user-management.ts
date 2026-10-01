import type { Database } from "@/types/database";

export type AdminUserSummary = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone_e164: string | null;
  role: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  banned_until: string | null;
  used_businesses: number;
  allowed_businesses: number;
  subscription_plan: string;
  subscription_status: string;
  subscription_period_end: string | null;
};

export type DatabaseWithAdminUserManagement = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Functions"> & {
    Functions: Database["public"]["Functions"] & {
      admin_search_users: {
        Args: { p_query?: string; p_limit?: number };
        Returns: AdminUserSummary[];
      };
    };
  };
};
