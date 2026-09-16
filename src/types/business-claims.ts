import type { Database } from "@/types/database";

type BusinessClaimsTable = {
  Row: {
    business_id: number;
    claim_email: string;
    created_by: string | null;
    created_at: string;
    claimed_at: string | null;
    claimed_by: string | null;
  };
  Insert: {
    business_id: number;
    claim_email: string;
    created_by?: string | null;
    created_at?: string;
    claimed_at?: string | null;
    claimed_by?: string | null;
  };
  Update: {
    business_id?: number;
    claim_email?: string;
    created_by?: string | null;
    created_at?: string;
    claimed_at?: string | null;
    claimed_by?: string | null;
  };
  Relationships: [];
};

export type DatabaseWithBusinessClaims = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & {
      business_claims: BusinessClaimsTable;
    };
  };
};
