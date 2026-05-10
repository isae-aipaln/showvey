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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      evaluations_staff_1: {
        Row: {
          Comment: string | null
          Evaluator_ID: string | null
          ID: number
          Liked_images: Json | null
          Project_name: string | null
          Style_no: string
        }
        Insert: {
          Comment?: string | null
          Evaluator_ID?: string | null
          ID?: number
          Liked_images?: Json | null
          Project_name?: string | null
          Style_no: string
        }
        Update: {
          Comment?: string | null
          Evaluator_ID?: string | null
          ID?: number
          Liked_images?: Json | null
          Project_name?: string | null
          Style_no?: string
        }
        Relationships: []
      }
      evaluations_staff_2: {
        Row: {
          Comment: string | null
          Evaluator_ID: string | null
          ID: number
          Liked_images: Json | null
          Price: string | null
          Project_name: string | null
          Purchase_intent: string | null
          Style_no: string
        }
        Insert: {
          Comment?: string | null
          Evaluator_ID?: string | null
          ID?: number
          Liked_images?: Json | null
          Price?: string | null
          Project_name?: string | null
          Purchase_intent?: string | null
          Style_no: string
        }
        Update: {
          Comment?: string | null
          Evaluator_ID?: string | null
          ID?: number
          Liked_images?: Json | null
          Price?: string | null
          Project_name?: string | null
          Purchase_intent?: string | null
          Style_no?: string
        }
        Relationships: []
      }
      evaluations_store: {
        Row: {
          Comment: string | null
          Evaluator_ID: string | null
          ID: number
          Liked_images: Json | null
          Order_count: string | null
          Price: string | null
          Project_name: string | null
          Style_no: string
        }
        Insert: {
          Comment?: string | null
          Evaluator_ID?: string | null
          ID?: number
          Liked_images?: Json | null
          Order_count?: string | null
          Price?: string | null
          Project_name?: string | null
          Style_no: string
        }
        Update: {
          Comment?: string | null
          Evaluator_ID?: string | null
          ID?: number
          Liked_images?: Json | null
          Order_count?: string | null
          Price?: string | null
          Project_name?: string | null
          Style_no?: string
        }
        Relationships: []
      }
      ID_admin: {
        Row: {
          Code: string
          ID: string
          Role: string | null
        }
        Insert: {
          Code: string
          ID: string
          Role?: string | null
        }
        Update: {
          Code?: string
          ID?: string
          Role?: string | null
        }
        Relationships: []
      }
      ID_staff_1: {
        Row: {
          Code: string
          ID: string
          Role: string | null
        }
        Insert: {
          Code: string
          ID: string
          Role?: string | null
        }
        Update: {
          Code?: string
          ID?: string
          Role?: string | null
        }
        Relationships: []
      }
      ID_staff_2: {
        Row: {
          Code: string
          ID: string
          Role: string | null
        }
        Insert: {
          Code: string
          ID: string
          Role?: string | null
        }
        Update: {
          Code?: string
          ID?: string
          Role?: string | null
        }
        Relationships: []
      }
      ID_store: {
        Row: {
          Code: string
          ID: string
          Role: string | null
        }
        Insert: {
          Code: string
          ID: string
          Role?: string | null
        }
        Update: {
          Code?: string
          ID?: string
          Role?: string | null
        }
        Relationships: []
      }
      product_information: {
        Row: {
          Add_labor_info: string | null
          Composition: string | null
          Consumption: number | null
          Coord_image_urls: Json | null
          Etc_rawmat_info: string | null
          Fabric_name: string | null
          Fabric_width: string | null
          Labor_cost: number | null
          Markup: number | null
          Mfg_cost: number | null
          MINI_DELI_Stock_preorder: string | null
          Product_image_urls: Json | null
          Project_name: string | null
          Raw_material_cost: number | null
          Sale_price: number | null
          sort_order: number | null
          Special_trim_cost: number | null
          Style_no: string
          Sub_material_cost: number | null
          Thumbnail_url: string | null
          Unit_cost: number | null
        }
        Insert: {
          Add_labor_info?: string | null
          Composition?: string | null
          Consumption?: number | null
          Coord_image_urls?: Json | null
          Etc_rawmat_info?: string | null
          Fabric_name?: string | null
          Fabric_width?: string | null
          Labor_cost?: number | null
          Markup?: number | null
          Mfg_cost?: number | null
          MINI_DELI_Stock_preorder?: string | null
          Product_image_urls?: Json | null
          Project_name?: string | null
          Raw_material_cost?: number | null
          Sale_price?: number | null
          sort_order?: number | null
          Special_trim_cost?: number | null
          Style_no: string
          Sub_material_cost?: number | null
          Thumbnail_url?: string | null
          Unit_cost?: number | null
        }
        Update: {
          Add_labor_info?: string | null
          Composition?: string | null
          Consumption?: number | null
          Coord_image_urls?: Json | null
          Etc_rawmat_info?: string | null
          Fabric_name?: string | null
          Fabric_width?: string | null
          Labor_cost?: number | null
          Markup?: number | null
          Mfg_cost?: number | null
          MINI_DELI_Stock_preorder?: string | null
          Product_image_urls?: Json | null
          Project_name?: string | null
          Raw_material_cost?: number | null
          Sale_price?: number | null
          sort_order?: number | null
          Special_trim_cost?: number | null
          Style_no?: string
          Sub_material_cost?: number | null
          Thumbnail_url?: string | null
          Unit_cost?: number | null
        }
        Relationships: []
      }
      Project_list: {
        Row: {
          Arrangement: string | null
          Period: string
          Project_name: string
          Status: boolean | null
          Total_style: number | null
        }
        Insert: {
          Arrangement?: string | null
          Period: string
          Project_name: string
          Status?: boolean | null
          Total_style?: number | null
        }
        Update: {
          Arrangement?: string | null
          Period?: string
          Project_name?: string
          Status?: boolean | null
          Total_style?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      reset_evaluations: { Args: never; Returns: undefined }
      storage_key_to_style_no: { Args: { p_key: string }; Returns: string }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
