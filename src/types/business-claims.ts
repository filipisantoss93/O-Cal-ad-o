import type { Database } from "@/types/database";

type BaseBusinessTable = Database["public"]["Tables"]["businesses"];

type BusinessTableWithPreRegistration = {
  Row: BaseBusinessTable["Row"] & {
    pre_registered: boolean;
  };
  Insert: BaseBusinessTable["Insert"] & {
    pre_registered?: boolean;
  };
  Update: BaseBusinessTable["Update"] & {
    pre_registered?: boolean;
  };
  Relationships: BaseBusinessTable["Relationships"];
};

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
    Tables: Omit<Database["public"]["Tables"], "businesses"> & {
      businesses: BusinessTableWithPreRegistration;
      business_claims: BusinessClaimsTable;
    };
  };
};
