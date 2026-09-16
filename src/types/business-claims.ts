import type { Database } from "@/types/database";

type BaseBusinessTable = Database["public"]["Tables"]["businesses"];

type BusinessTableWithPreRegistration = {
  Row: BaseBusinessTable["Row"] & {
    pre_registered: boolean;
    publication_status: string;
    data_source_url: string | null;
    data_source_checked_at: string | null;
  };
  Insert: BaseBusinessTable["Insert"] & {
    pre_registered?: boolean;
    publication_status?: string;
    data_source_url?: string | null;
    data_source_checked_at?: string | null;
  };
  Update: BaseBusinessTable["Update"] & {
    pre_registered?: boolean;
    publication_status?: string;
    data_source_url?: string | null;
    data_source_checked_at?: string | null;
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

type BusinessClaimRequestsTable = {
  Row: {
    id: number;
    business_id: number;
    requester_id: string;
    requester_name: string;
    requester_email: string;
    relationship: string;
    evidence: string;
    status: string;
    admin_note: string | null;
    reviewed_at: string | null;
    reviewed_by: string | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: number;
    business_id: number;
    requester_id: string;
    requester_name: string;
    requester_email: string;
    relationship: string;
    evidence: string;
    status?: string;
    admin_note?: string | null;
    reviewed_at?: string | null;
    reviewed_by?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: Partial<BusinessClaimRequestsTable["Insert"]>;
  Relationships: [];
};

type BusinessListingRequestsTable = {
  Row: {
    id: number;
    business_id: number;
    requester_id: string | null;
    requester_name: string;
    requester_email: string;
    request_type: string;
    details: string;
    status: string;
    admin_note: string | null;
    reviewed_at: string | null;
    reviewed_by: string | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: number;
    business_id: number;
    requester_id?: string | null;
    requester_name: string;
    requester_email: string;
    request_type: string;
    details: string;
    status?: string;
    admin_note?: string | null;
    reviewed_at?: string | null;
    reviewed_by?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: Partial<BusinessListingRequestsTable["Insert"]>;
  Relationships: [];
};

type ReviewBusinessClaimRequestFunction = {
  Args: {
    p_request_id: number;
    p_decision: string;
    p_admin_note?: string | null;
  };
  Returns: undefined;
};

type ReviewBusinessListingRequestFunction = {
  Args: {
    p_request_id: number;
    p_decision: string;
    p_admin_note?: string | null;
  };
  Returns: undefined;
};

export type DatabaseWithBusinessClaims = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables" | "Functions"> & {
    Tables: Omit<Database["public"]["Tables"], "businesses"> & {
      businesses: BusinessTableWithPreRegistration;
      business_claims: BusinessClaimsTable;
      business_claim_requests: BusinessClaimRequestsTable;
      business_listing_requests: BusinessListingRequestsTable;
    };
    Functions: Database["public"]["Functions"] & {
      review_business_claim_request: ReviewBusinessClaimRequestFunction;
      review_business_listing_request: ReviewBusinessListingRequestFunction;
    };
  };
};
