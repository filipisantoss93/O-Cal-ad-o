export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type ProfileRow = {
  id: string;
  name: string;
  phone_e164: string | null;
  created_at: string;
  updated_at: string;
};

type CityRow = {
  id: number;
  slug: string;
  name: string;
  state: string;
  is_active: boolean;
  created_at: string;
};

type CategoryRow = {
  id: number;
  slug: string;
  name: string;
  icon: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
};

type BusinessRow = {
  id: number;
  owner_id: string;
  city_id: number;
  category_id: number;
  slug: string;
  name: string;
  description: string | null;
  whatsapp_e164: string | null;
  address: string;
  neighborhood: string;
  logo_path: string | null;
  cover_path: string | null;
  business_hours: Json;
  status: "draft" | "published" | "suspended";
  is_featured: boolean;
  created_at: string;
  updated_at: string;
};

type ProductRow = {
  id: number;
  business_id: number;
  name: string;
  description: string | null;
  price: number;
  promotional_price: number | null;
  image_path: string | null;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
};

type PromotionRow = {
  id: number;
  business_id: number;
  title: string;
  description: string | null;
  badge: string | null;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type TableDefinition<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDefinition<
        ProfileRow,
        {
          id: string;
          name: string;
          phone_e164?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      cities: TableDefinition<
        CityRow,
        {
          id?: number;
          slug: string;
          name: string;
          state: string;
          is_active?: boolean;
          created_at?: string;
        }
      >;
      categories: TableDefinition<
        CategoryRow,
        {
          id?: number;
          slug: string;
          name: string;
          icon: string;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
        }
      >;
      businesses: TableDefinition<
        BusinessRow,
        {
          id?: number;
          owner_id: string;
          city_id: number;
          category_id: number;
          slug: string;
          name: string;
          description?: string | null;
          whatsapp_e164?: string | null;
          address: string;
          neighborhood: string;
          logo_path?: string | null;
          cover_path?: string | null;
          business_hours?: Json;
          status?: "draft" | "published" | "suspended";
          is_featured?: boolean;
          created_at?: string;
          updated_at?: string;
        }
      >;
      products: TableDefinition<
        ProductRow,
        {
          id?: number;
          business_id: number;
          name: string;
          description?: string | null;
          price: number;
          promotional_price?: number | null;
          image_path?: string | null;
          is_active?: boolean;
          is_featured?: boolean;
          created_at?: string;
          updated_at?: string;
        }
      >;
      promotions: TableDefinition<
        PromotionRow,
        {
          id?: number;
          business_id: number;
          title: string;
          description?: string | null;
          badge?: string | null;
          starts_at: string;
          ends_at: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        }
      >;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
