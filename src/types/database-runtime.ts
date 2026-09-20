import type { Database as GeneratedDatabase } from "@/types/database";

type GeneratedBusinessTable = GeneratedDatabase["public"]["Tables"]["businesses"];
type GeneratedPublicSchema = GeneratedDatabase["public"];

type AdministrativeTable<Row, Insert> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Insert>;
  Relationships: [];
};

type SupportMessage = {
  id: number; sender_id: string | null; name: string; email: string;
  subject: string; message: string; status: string; created_at: string;
};
type BusinessReport = {
  id: number; business_id: number; sender_id: string | null;
  name: string; email: string; reason: string; details: string;
  status: string; created_at: string;
};
type AdminNotification = {
  id: number; recipient_id: string; event_type: string; source_id: string;
  title: string; body: string; destination: string; read_at: string | null;
  pushed_at: string | null; push_attempts: number; created_at: string;
};
type EventRow = {
  id: number; business_id: number; city_id: number; title: string;
  description: string; category: string; banner_path: string; venue_name: string;
  venue_address: string; starts_at: string; ends_at: string | null;
  utc_offset: string; free_entry: boolean; ticket_price_cents: number | null;
  ticket_url: string | null; is_active: boolean; created_at: string; updated_at: string;
};
type EventInsert = Omit<EventRow, "id" | "created_at" | "updated_at">;

type EventHighlightRow = {
  id: number; event_id: number; city_id: number; requester_id: string;
  status: "pending" | "active" | "cancelled" | "expired";
  amount_paid_cents: number | null; payment_reference: string | null;
  paid_at: string | null; starts_at: string | null; ends_at: string | null;
  product_code: string | null; quoted_price_cents: number | null;
  provider_charge_id: string | null; provider_payment_url: string | null;
  payment_expires_at: string | null;
  created_at: string; updated_at: string;
};
type EventHighlightInsert = Pick<EventHighlightRow, "event_id" | "requester_id"> &
  Partial<Omit<EventHighlightRow, "id" | "event_id" | "requester_id" | "created_at">>;
type EventHighlightPackage = {
  code: string; duration_days: number; price_cents: number;
  is_active: boolean; created_at: string;
};
type EventHighlightPackageInsert = Pick<EventHighlightPackage,"code" | "duration_days" | "price_cents"> &
  Partial<Pick<EventHighlightPackage,"is_active">>;


type SeoReviewRow = {
  id: number; business_id: number; related_business_id: number | null;
  issue_code: string; priority: number; status: string;
  evidence: Record<string, unknown>;
  review_note: string | null; reviewed_at: string | null;
  reviewed_by: string | null; created_at: string; updated_at: string;
};

type PushSubscriptionRow = {
  endpoint: string; user_id: string; p256dh: string; auth: string; created_at: string;
};

/**
 * Extensão transitória dos tipos gerados do Supabase para colunas adicionadas
 * por migrações recentes. Mantém o cliente tipado sem relaxar o Database inteiro.
 */
export type Database = Omit<GeneratedDatabase, "public"> & {
  public: Omit<GeneratedPublicSchema, "Tables" | "Functions"> & {
    Functions: GeneratedPublicSchema["Functions"] & {
      admin_vapid_public_key: { Args: Record<PropertyKey, never>; Returns: string | null };
    };
    Tables: Omit<GeneratedPublicSchema["Tables"], "businesses"> & {
      events: AdministrativeTable<EventRow, EventInsert>;
      event_highlights: AdministrativeTable<EventHighlightRow, EventHighlightInsert>;
      event_highlight_packages: AdministrativeTable<EventHighlightPackage, EventHighlightPackageInsert>;
      business_seo_review_queue: AdministrativeTable<SeoReviewRow,
        Pick<SeoReviewRow, "status" | "review_note" | "reviewed_at" | "reviewed_by" | "updated_at">>;
      support_messages: AdministrativeTable<SupportMessage, Pick<SupportMessage, "name" | "email" | "subject" | "message"> & Partial<Pick<SupportMessage, "status" | "sender_id">>>;
      business_reports: AdministrativeTable<BusinessReport, Pick<BusinessReport, "business_id" | "name" | "email" | "reason" | "details"> & Partial<Pick<BusinessReport, "status" | "sender_id">>>;
      admin_notifications: AdministrativeTable<AdminNotification, Pick<AdminNotification, "recipient_id" | "event_type" | "source_id" | "title" | "body" | "destination"> & Partial<Pick<AdminNotification, "read_at" | "pushed_at" | "push_attempts">>>;
      admin_push_subscriptions: AdministrativeTable<PushSubscriptionRow, Pick<PushSubscriptionRow, "endpoint" | "user_id" | "p256dh" | "auth">>;
      businesses: {
        Row: GeneratedBusinessTable["Row"] & {
          publication_status: string;
          listing_type: string;
          public_place_kind: string | null;
          official_source_url: string | null;
          pre_registered: boolean;
          google_place_id: string | null;
          data_source_url: string | null;
        };
        Insert: GeneratedBusinessTable["Insert"] & {
          publication_status?: string;
          listing_type?: string;
          public_place_kind?: string | null;
          official_source_url?: string | null;
          pre_registered?: boolean;
          google_place_id?: string | null;
          data_source_url?: string | null;
        };
        Update: GeneratedBusinessTable["Update"] & {
          publication_status?: string;
          listing_type?: string;
          public_place_kind?: string | null;
          official_source_url?: string | null;
          pre_registered?: boolean;
          google_place_id?: string | null;
          data_source_url?: string | null;
        };
        Relationships: GeneratedBusinessTable["Relationships"];
      };
    };
  };
};
