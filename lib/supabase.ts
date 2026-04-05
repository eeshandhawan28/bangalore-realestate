import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      properties: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          location: string;
          area_type: string;
          total_sqft: number;
          bhk: number;
          bathrooms: number;
          balconies: number;
          purchase_price_lakhs: number;
          purchase_date: string;
          ownership_type: string;
          notes: string | null;
          ai_estimated_value_lakhs: number | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["properties"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["properties"]["Insert"]>;
      };
    };
  };
};
