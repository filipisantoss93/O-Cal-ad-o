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
          updated_at: string
          website_url: string | null
          whatsapp_e164: string
        }
        Insert: {
          address_number: string
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
          updated_at?: string
          website_url?: string | null
          whatsapp_e164: string
        }
        Update: {
          address_number?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
