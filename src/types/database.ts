export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      billing_addons: {
        Row: {
          active_from: string | null
          active_until: string | null
          business_id: number | null
          cancel_at_period_end: boolean
          created_at: string
          id: number
          payment_method: string
          product_code: string
          provider: string
          provider_charge_id: string | null
          provider_plan_id: string | null
          provider_subscription_id: string | null
          quantity: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_from?: string | null
          active_until?: string | null
          business_id?: number | null
          cancel_at_period_end?: boolean
          created_at?: string
          id?: never
          payment_method?: string
          product_code: string
          provider?: string
          provider_charge_id?: string | null
          provider_plan_id?: string | null
          provider_subscription_id?: string | null
          quantity?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_from?: string | null
          active_until?: string | null
          business_id?: number | null
          cancel_at_period_end?: boolean
          created_at?: string
          id?: never
          payment_method?: string
          product_code?: string
          provider?: string
          provider_charge_id?: string | null
          provider_plan_id?: string | null
          provider_subscription_id?: string | null
          quantity?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_addons_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_addons_product_code_fkey"
            columns: ["product_code"]
            isOneToOne: false
            referencedRelation: "billing_products"
            referencedColumns: ["code"]
          },
        ]
      }
      billing_plan_prices: {
        Row: {
          billing_cycle: string
          created_at: string
          id: number
          interval_months: number
          is_active: boolean
          plan_code: string
          price_cents: number
          updated_at: string
        }
        Insert: {
          billing_cycle: string
          created_at?: string
          id?: never
          interval_months: number
          is_active?: boolean
          plan_code: string
          price_cents: number
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          created_at?: string
          id?: never
          interval_months?: number
          is_active?: boolean
          plan_code?: string
          price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_plan_prices_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "billing_plan_rules"
            referencedColumns: ["code"]
          },
        ]
      }
      billing_plan_rules: {
        Row: {
          code: string
          created_at: string
          included_businesses: number
          included_promotions_per_business: number
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          included_businesses: number
          included_promotions_per_business: number
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          included_businesses?: number
          included_promotions_per_business?: number
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      billing_products: {
        Row: {
          billing_mode: string
          code: string
          created_at: string
          is_active: boolean
          kind: string
          name: string
          price_cents: number
          units: number
          updated_at: string
        }
        Insert: {
          billing_mode: string
          code: string
          created_at?: string
          is_active?: boolean
          kind: string
          name: string
          price_cents: number
          units: number
          updated_at?: string
        }
        Update: {
          billing_mode?: string
          code?: string
          created_at?: string
          is_active?: boolean
          kind?: string
          name?: string
          price_cents?: number
          units?: number
          updated_at?: string
        }
        Relationships: []
      }
      billing_provider_events: {
        Row: {
          event_key: string
          event_type: string | null
          payload: Json | null
          processed_at: string
          provider: string
          provider_event_id: string | null
        }
        Insert: {
          event_key: string
          event_type?: string | null
          payload?: Json | null
          processed_at?: string
          provider: string
          provider_event_id?: string | null
        }
        Update: {
          event_key?: string
          event_type?: string | null
          payload?: Json | null
          processed_at?: string
          provider?: string
          provider_event_id?: string | null
        }
        Relationships: []
      }
      business_hours: {
        Row: {
          business_id: number
          closes_at: string | null
          created_at: string
          display_order: number
          id: number
          is_closed: boolean
          opens_at: string | null
          updated_at: string
          weekday: number
        }
        Insert: {
          business_id: number
          closes_at?: string | null
          created_at?: string
          display_order?: number
          id?: never
          is_closed?: boolean
          opens_at?: string | null
          updated_at?: string
          weekday: number
        }
        Update: {
          business_id?: number
          closes_at?: string | null
          created_at?: string
          display_order?: number
          id?: never
          is_closed?: boolean
          opens_at?: string | null
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_photos: {
        Row: {
          alt_text: string | null
          business_id: number
          created_at: string
          display_order: number
          id: number
          path: string
        }
        Insert: {
          alt_text?: string | null
          business_id: number
          created_at?: string
          display_order?: number
          id?: never
          path: string
        }
        Update: {
          alt_text?: string | null
          business_id?: number
          created_at?: string
          display_order?: number
          id?: never
          path?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_photos_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address_number: string
          billing_suspended: boolean
          billing_suspension_reason: string | null
          category_id: number
          city_id: number
          complement: string | null
          cover_path: string | null
          created_at: string
          description: string | null
          featured_until: string | null
          id: number
          is_active: boolean
          latitude: number | null
          logo_path: string | null
          longitude: number | null
          moderated_at: string | null
          moderated_by: string | null
          moderation_note: string | null
          name: string
          neighborhood: string
          owner_id: string
          plan: string
          postal_code: string | null
          public_email: string | null
          search_document: unknown
          slug: string
          status: string
          street: string
          tags: string[]
          updated_at: string
          website_url: string | null
          whatsapp_e164: string
        }
        Insert: {
          address_number: string
          billing_suspended?: boolean
          billing_suspension_reason?: string | null
          category_id: number
          city_id: number
          complement?: string | null
          cover_path?: string | null
          created_at?: string
          description?: string | null
          featured_until?: string | null
          id?: never
          is_active?: boolean
          latitude?: number | null
          logo_path?: string | null
          longitude?: number | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_note?: string | null
          name: string
          neighborhood: string
          owner_id: string
          plan?: string
          postal_code?: string | null
          public_email?: string | null
          search_document?: unknown
          slug: string
          status?: string
          street: string
          tags?: string[]
          updated_at?: string
          website_url?: string | null
          whatsapp_e164: string
        }
        Update: {
          address_number?: string
          billing_suspended?: boolean
          billing_suspension_reason?: string | null
          category_id?: number
          city_id?: number
          complement?: string | null
          cover_path?: string | null
          created_at?: string
          description?: string | null
          featured_until?: string | null
          id?: never
          is_active?: boolean
          latitude?: number | null
          logo_path?: string | null
          longitude?: number | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_note?: string | null
          name?: string
          neighborhood?: string
          owner_id?: string
          plan?: string
          postal_code?: string | null
          public_email?: string | null
          search_document?: unknown
          slug?: string
          status?: string
          street?: string
          tags?: string[]
          updated_at?: string
          website_url?: string | null
          whatsapp_e164?: string
        }
        Relationships: [
          {
            foreignKeyName: "businesses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "businesses_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_items: {
        Row: {
          business_id: number
          created_at: string
          description: string | null
          id: number
          image_path: string | null
          is_active: boolean
          is_featured: boolean
          kind: string
          name: string
          price: number | null
          promotional_price: number | null
          search_document: unknown
          updated_at: string
        }
        Insert: {
          business_id: number
          created_at?: string
          description?: string | null
          id?: never
          image_path?: string | null
          is_active?: boolean
          is_featured?: boolean
          kind?: string
          name: string
          price?: number | null
          promotional_price?: number | null
          search_document?: unknown
          updated_at?: string
        }
        Update: {
          business_id?: number
          created_at?: string
          description?: string | null
          id?: never
          image_path?: string | null
          is_active?: boolean
          is_featured?: boolean
          kind?: string
          name?: string
          price?: number | null
          promotional_price?: number | null
          search_document?: unknown
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          icon: string
          id: number
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          icon: string
          id?: never
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string
          id?: never
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      cities: {
        Row: {
          created_at: string
          ibge_code: number | null
          id: number
          is_active: boolean
          name: string
          slug: string
          state_code: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ibge_code?: number | null
          id?: never
          is_active?: boolean
          name: string
          slug: string
          state_code: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ibge_code?: number | null
          id?: never
          is_active?: boolean
          name?: string
          slug?: string
          state_code?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cities_state_code_fkey"
            columns: ["state_code"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["code"]
          },
        ]
      }
      highlight_campaigns: {
        Row: {
          activated_at: string | null
          admin_note: string | null
          base_price_cents: number
          business_id: number
          category_id: number
          charged_price_cents: number
          city_id: number
          completed_at: string | null
          created_at: string
          discount_cents: number
          duration_days: number
          ends_at: string
          id: number
          package_code: string
          pause_reason: string | null
          paused_at: string | null
          placement: string
          provider: string
          provider_charge_id: string | null
          provider_payment_url: string | null
          remaining_seconds: number
          reservation_expires_at: string | null
          starts_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          admin_note?: string | null
          base_price_cents: number
          business_id: number
          category_id: number
          charged_price_cents: number
          city_id: number
          completed_at?: string | null
          created_at?: string
          discount_cents?: number
          duration_days: number
          ends_at: string
          id?: never
          package_code: string
          pause_reason?: string | null
          paused_at?: string | null
          placement: string
          provider?: string
          provider_charge_id?: string | null
          provider_payment_url?: string | null
          remaining_seconds: number
          reservation_expires_at?: string | null
          starts_at: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          admin_note?: string | null
          base_price_cents?: number
          business_id?: number
          category_id?: number
          charged_price_cents?: number
          city_id?: number
          completed_at?: string | null
          created_at?: string
          discount_cents?: number
          duration_days?: number
          ends_at?: string
          id?: never
          package_code?: string
          pause_reason?: string | null
          paused_at?: string | null
          placement?: string
          provider?: string
          provider_charge_id?: string | null
          provider_payment_url?: string | null
          remaining_seconds?: number
          reservation_expires_at?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "highlight_campaigns_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "highlight_campaigns_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "highlight_campaigns_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "highlight_campaigns_package_code_fkey"
            columns: ["package_code"]
            isOneToOne: false
            referencedRelation: "highlight_packages"
            referencedColumns: ["code"]
          },
        ]
      }
      highlight_daily_metrics: {
        Row: {
          campaign_id: number
          directions_clicks: number
          impressions: number
          metric_date: string
          store_views: number
          updated_at: string
          whatsapp_clicks: number
        }
        Insert: {
          campaign_id: number
          directions_clicks?: number
          impressions?: number
          metric_date: string
          store_views?: number
          updated_at?: string
          whatsapp_clicks?: number
        }
        Update: {
          campaign_id?: number
          directions_clicks?: number
          impressions?: number
          metric_date?: string
          store_views?: number
          updated_at?: string
          whatsapp_clicks?: number
        }
        Relationships: [
          {
            foreignKeyName: "highlight_daily_metrics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "highlight_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      highlight_packages: {
        Row: {
          code: string
          created_at: string
          display_order: number
          duration_days: number
          is_active: boolean
          name: string
          placement: string
          price_cents: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          display_order?: number
          duration_days: number
          is_active?: boolean
          name: string
          placement: string
          price_cents: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          display_order?: number
          duration_days?: number
          is_active?: boolean
          name?: string
          placement?: string
          price_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      highlight_placement_rules: {
        Row: {
          code: string
          created_at: string
          is_active: boolean
          max_active: number
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          is_active?: boolean
          max_active: number
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          is_active?: boolean
          max_active?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone_e164: string | null
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone_e164?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone_e164?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          billing_suspended: boolean
          billing_suspension_reason: string | null
          business_id: number
          created_at: string
          description: string | null
          ends_at: string
          id: number
          image_path: string | null
          is_active: boolean
          offer_price: number
          original_price: number | null
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          billing_suspended?: boolean
          billing_suspension_reason?: string | null
          business_id: number
          created_at?: string
          description?: string | null
          ends_at: string
          id?: never
          image_path?: string | null
          is_active?: boolean
          offer_price: number
          original_price?: number | null
          starts_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          billing_suspended?: boolean
          billing_suspension_reason?: string | null
          business_id?: number
          created_at?: string
          description?: string | null
          ends_at?: string
          id?: never
          image_path?: string | null
          is_active?: boolean
          offer_price?: number
          original_price?: number | null
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      states: {
        Row: {
          code: string
          created_at: string
          ibge_code: number
          is_active: boolean
          name: string
          region_code: string
          region_name: string
          slug: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          ibge_code: number
          is_active?: boolean
          name: string
          region_code: string
          region_name: string
          slug: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          ibge_code?: number
          is_active?: boolean
          name?: string
          region_code?: string
          region_name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_cycle: string
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: number
          payment_method: string
          plan_code: string
          provider: string
          provider_charge_id: string | null
          provider_plan_id: string | null
          provider_recurrence_id: string | null
          provider_subscription_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_cycle: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: never
          payment_method: string
          plan_code?: string
          provider?: string
          provider_charge_id?: string | null
          provider_plan_id?: string | null
          provider_recurrence_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_cycle?: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: never
          payment_method?: string
          plan_code?: string
          provider?: string
          provider_charge_id?: string | null
          provider_plan_id?: string | null
          provider_recurrence_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "billing_plan_rules"
            referencedColumns: ["code"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_create_highlight_campaign: {
        Args: {
          p_admin_note?: string
          p_business_id: number
          p_package_code: string
          p_requested_start?: string
        }
        Returns: number
      }
      admin_manage_highlight_campaign: {
        Args: { p_action: string; p_bonus_days?: number; p_campaign_id: number }
        Returns: boolean
      }
      process_efi_billing_event: {
        Args: {
          p_charge_id?: string
          p_event_key: string
          p_event_type: string
          p_payload?: Json
          p_status: string
          p_subscription_id?: string
        }
        Returns: boolean
      }
      record_highlight_event: {
        Args: {
          p_campaign_id: number
          p_event_type: string
          p_visitor_hash: string
        }
        Returns: boolean
      }
      reserve_highlight_campaign: {
        Args: {
          p_business_id: number
          p_package_code: string
          p_requested_start?: string
          p_user_id: string
        }
        Returns: {
          campaign_id: number
          charged_price_cents: number
          duration_days: number
          package_name: string
        }[]
      }
      resolve_city_by_coordinates: {
        Args: { input_latitude: number; input_longitude: number }
        Returns: {
          ibge_code: number
          id: number
          name: string
          state_code: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
