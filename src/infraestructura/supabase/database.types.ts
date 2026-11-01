// ARCHIVO GENERADO a partir del esquema de Supabase. No editar a mano.
// Regenerar tras cada migración (ver docs/infraestructura.md).

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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      excepcion_asistencia: {
        Row: {
          comida: string
          fecha: string
          hogar_id: string
          lugar: string
          nota: string | null
          para_llevar: boolean
          persona_id: string
        }
        Insert: {
          comida: string
          fecha: string
          hogar_id: string
          lugar: string
          nota?: string | null
          para_llevar?: boolean
          persona_id: string
        }
        Update: {
          comida?: string
          fecha?: string
          hogar_id?: string
          lugar?: string
          nota?: string | null
          para_llevar?: boolean
          persona_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "excepcion_asistencia_persona_id_hogar_id_fkey"
            columns: ["persona_id", "hogar_id"]
            isOneToOne: false
            referencedRelation: "persona"
            referencedColumns: ["id", "hogar_id"]
          },
        ]
      }
      hogar: {
        Row: {
          creado_en: string
          creado_por: string
          id: string
          nombre: string
        }
        Insert: {
          creado_en?: string
          creado_por?: string
          id?: string
          nombre: string
        }
        Update: {
          creado_en?: string
          creado_por?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      invitacion: {
        Row: {
          caduca_en: string
          codigo_hash: string
          creada_en: string
          creada_por: string
          hogar_id: string
          id: string
          rol: string
          usada_en: string | null
          usada_por: string | null
        }
        Insert: {
          caduca_en?: string
          codigo_hash: string
          creada_en?: string
          creada_por: string
          hogar_id: string
          id?: string
          rol?: string
          usada_en?: string | null
          usada_por?: string | null
        }
        Update: {
          caduca_en?: string
          codigo_hash?: string
          creada_en?: string
          creada_por?: string
          hogar_id?: string
          id?: string
          rol?: string
          usada_en?: string | null
          usada_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitacion_hogar_id_fkey"
            columns: ["hogar_id"]
            isOneToOne: false
            referencedRelation: "hogar"
            referencedColumns: ["id"]
          },
        ]
      }
      miembro: {
        Row: {
          creado_en: string
          hogar_id: string
          rol: string
          user_id: string
        }
        Insert: {
          creado_en?: string
          hogar_id: string
          rol?: string
          user_id: string
        }
        Update: {
          creado_en?: string
          hogar_id?: string
          rol?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "miembro_hogar_id_fkey"
            columns: ["hogar_id"]
            isOneToOne: false
            referencedRelation: "hogar"
            referencedColumns: ["id"]
          },
        ]
      }
      patron_asistencia: {
        Row: {
          comida: string
          dia_semana: number
          hogar_id: string
          lugar: string
          persona_id: string
        }
        Insert: {
          comida: string
          dia_semana: number
          hogar_id: string
          lugar: string
          persona_id: string
        }
        Update: {
          comida?: string
          dia_semana?: number
          hogar_id?: string
          lugar?: string
          persona_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patron_asistencia_persona_id_hogar_id_fkey"
            columns: ["persona_id", "hogar_id"]
            isOneToOne: false
            referencedRelation: "persona"
            referencedColumns: ["id", "hogar_id"]
          },
        ]
      }
      persona: {
        Row: {
          activa: boolean
          creado_en: string
          factor_racion: number
          hogar_id: string
          id: string
          nombre: string
          tipo: string
          user_id: string | null
        }
        Insert: {
          activa?: boolean
          creado_en?: string
          factor_racion?: number
          hogar_id: string
          id?: string
          nombre: string
          tipo: string
          user_id?: string | null
        }
        Update: {
          activa?: boolean
          creado_en?: string
          factor_racion?: number
          hogar_id?: string
          id?: string
          nombre?: string
          tipo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "persona_hogar_id_fkey"
            columns: ["hogar_id"]
            isOneToOne: false
            referencedRelation: "hogar"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      crear_hogar: { Args: { p_nombre: string }; Returns: string }
      crear_invitacion: {
        Args: { p_hogar_id: string; p_rol?: string }
        Returns: string
      }
      unirse_a_hogar: { Args: { p_codigo: string }; Returns: string }
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
