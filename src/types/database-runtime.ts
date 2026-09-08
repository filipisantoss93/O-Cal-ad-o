import type { Database as GeneratedDatabase } from "@/types/database";

type GeneratedBusinessTable = GeneratedDatabase["public"]["Tables"]["businesses"];
type GeneratedPublicSchema = GeneratedDatabase["public"];

/**
 * Extensão transitória dos tipos gerados do Supabase para colunas adicionadas
 * por migrações recentes. Mantém o cliente tipado sem relaxar o Database inteiro.
 */
export type Database = Omit<GeneratedDatabase, "public"> & {
  public: Omit<GeneratedPublicSchema, "Tables"> & {
    Tables: Omit<GeneratedPublicSchema["Tables"], "businesses"> & {
      businesses: {
        Row: GeneratedBusinessTable["Row"] & {
          publication_status: string;
        };
        Insert: GeneratedBusinessTable["Insert"] & {
          publication_status?: string;
        };
        Update: GeneratedBusinessTable["Update"] & {
          publication_status?: string;
        };
        Relationships: GeneratedBusinessTable["Relationships"];
      };
    };
  };
};
