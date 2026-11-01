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
      administrador_plataforma: {
        Row: {
          creado_en: string
          user_id: string
        }
        Insert: {
          creado_en?: string
          user_id: string
        }
        Update: {
          creado_en?: string
          user_id?: string
        }
        Relationships: []
      }
      centro: {
        Row: {
          creado_en: string
          creado_por: string | null
          id: string
          localidad: string | null
          nombre: string
        }
        Insert: {
          creado_en?: string
          creado_por?: string | null
          id?: string
          localidad?: string | null
          nombre: string
        }
        Update: {
          creado_en?: string
          creado_por?: string | null
          id?: string
          localidad?: string | null
          nombre?: string
        }
        Relationships: []
      }
      centro_codigo: {
        Row: {
          caduca_en: string
          centro_id: string
          codigo_hash: string
          creado_en: string
          creado_por: string | null
          id: string
          max_usos: number
          revocado: boolean
          usos: number
        }
        Insert: {
          caduca_en?: string
          centro_id: string
          codigo_hash: string
          creado_en?: string
          creado_por?: string | null
          id?: string
          max_usos?: number
          revocado?: boolean
          usos?: number
        }
        Update: {
          caduca_en?: string
          centro_id?: string
          codigo_hash?: string
          creado_en?: string
          creado_por?: string | null
          id?: string
          max_usos?: number
          revocado?: boolean
          usos?: number
        }
        Relationships: [
          {
            foreignKeyName: "centro_codigo_centro_id_fkey"
            columns: ["centro_id"]
            isOneToOne: false
            referencedRelation: "centro"
            referencedColumns: ["id"]
          },
        ]
      }
      centro_hogar: {
        Row: {
          centro_id: string
          hogar_id: string
          rol: string
          unido_en: string
        }
        Insert: {
          centro_id: string
          hogar_id: string
          rol?: string
          unido_en?: string
        }
        Update: {
          centro_id?: string
          hogar_id?: string
          rol?: string
          unido_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "centro_hogar_centro_id_fkey"
            columns: ["centro_id"]
            isOneToOne: false
            referencedRelation: "centro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "centro_hogar_hogar_id_fkey"
            columns: ["hogar_id"]
            isOneToOne: false
            referencedRelation: "hogar"
            referencedColumns: ["id"]
          },
        ]
      }
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
          creado_por: string | null
          id: string
          nombre: string
        }
        Insert: {
          creado_en?: string
          creado_por?: string | null
          id?: string
          nombre: string
        }
        Update: {
          creado_en?: string
          creado_por?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      ingrediente: {
        Row: {
          creado_en: string
          creado_por: string | null
          id: string
          nombre: string
          nombre_normalizado: string | null
          seccion: string
          unidad: string
          verificado: boolean
        }
        Insert: {
          creado_en?: string
          creado_por?: string | null
          id?: string
          nombre: string
          nombre_normalizado?: string | null
          seccion?: string
          unidad: string
          verificado?: boolean
        }
        Update: {
          creado_en?: string
          creado_por?: string | null
          id?: string
          nombre?: string
          nombre_normalizado?: string | null
          seccion?: string
          unidad?: string
          verificado?: boolean
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
      menu_cole_dia: {
        Row: {
          actualizado_en: string
          centro_id: string
          fecha: string
          grupo_primero: string | null
          grupo_segundo: string | null
          postre: string | null
          primero: string | null
          segundo: string | null
        }
        Insert: {
          actualizado_en?: string
          centro_id: string
          fecha: string
          grupo_primero?: string | null
          grupo_segundo?: string | null
          postre?: string | null
          primero?: string | null
          segundo?: string | null
        }
        Update: {
          actualizado_en?: string
          centro_id?: string
          fecha?: string
          grupo_primero?: string | null
          grupo_segundo?: string | null
          postre?: string | null
          primero?: string | null
          segundo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_cole_dia_centro_id_fkey"
            columns: ["centro_id"]
            isOneToOne: false
            referencedRelation: "centro"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_cole_dia_historial: {
        Row: {
          anterior: Json | null
          centro_id: string
          en: string
          fecha: string
          id: number
          nuevo: Json | null
          operacion: string
          usuario: string | null
        }
        Insert: {
          anterior?: Json | null
          centro_id: string
          en?: string
          fecha: string
          id?: never
          nuevo?: Json | null
          operacion: string
          usuario?: string | null
        }
        Update: {
          anterior?: Json | null
          centro_id?: string
          en?: string
          fecha?: string
          id?: never
          nuevo?: Json | null
          operacion?: string
          usuario?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_cole_dia_historial_centro_id_fkey"
            columns: ["centro_id"]
            isOneToOne: false
            referencedRelation: "centro"
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
      plato: {
        Row: {
          activo: boolean
          creado_en: string
          creado_por: string | null
          etiquetas: string[]
          grupo: string | null
          hogar_id: string
          id: string
          no_proponer: boolean
          nombre: string
          origen: string
          pasos: string | null
          plato_compartido_id: string | null
          rol: string
          tiempo_activo_min: number | null
          tiempo_total_min: number | null
        }
        Insert: {
          activo?: boolean
          creado_en?: string
          creado_por?: string | null
          etiquetas?: string[]
          grupo?: string | null
          hogar_id: string
          id?: string
          no_proponer?: boolean
          nombre: string
          origen?: string
          pasos?: string | null
          plato_compartido_id?: string | null
          rol: string
          tiempo_activo_min?: number | null
          tiempo_total_min?: number | null
        }
        Update: {
          activo?: boolean
          creado_en?: string
          creado_por?: string | null
          etiquetas?: string[]
          grupo?: string | null
          hogar_id?: string
          id?: string
          no_proponer?: boolean
          nombre?: string
          origen?: string
          pasos?: string | null
          plato_compartido_id?: string | null
          rol?: string
          tiempo_activo_min?: number | null
          tiempo_total_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plato_hogar_id_fkey"
            columns: ["hogar_id"]
            isOneToOne: false
            referencedRelation: "hogar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plato_plato_compartido_id_fkey"
            columns: ["plato_compartido_id"]
            isOneToOne: false
            referencedRelation: "plato_compartido"
            referencedColumns: ["id"]
          },
        ]
      }
      plato_compartido: {
        Row: {
          adopciones: number
          alias_autor: string | null
          enviado_en: string
          estado: string
          etiquetas: string[]
          grupo: string
          id: string
          motivo_rechazo: string | null
          nombre: string
          pasos: string | null
          revisado_en: string | null
          revisado_por: string | null
          rol: string
          tiempo_activo_min: number | null
          tiempo_total_min: number
        }
        Insert: {
          adopciones?: number
          alias_autor?: string | null
          enviado_en?: string
          estado?: string
          etiquetas?: string[]
          grupo: string
          id?: string
          motivo_rechazo?: string | null
          nombre: string
          pasos?: string | null
          revisado_en?: string | null
          revisado_por?: string | null
          rol: string
          tiempo_activo_min?: number | null
          tiempo_total_min: number
        }
        Update: {
          adopciones?: number
          alias_autor?: string | null
          enviado_en?: string
          estado?: string
          etiquetas?: string[]
          grupo?: string
          id?: string
          motivo_rechazo?: string | null
          nombre?: string
          pasos?: string | null
          revisado_en?: string | null
          revisado_por?: string | null
          rol?: string
          tiempo_activo_min?: number | null
          tiempo_total_min?: number
        }
        Relationships: []
      }
      plato_compartido_autor: {
        Row: {
          creado_en: string
          hogar_id: string | null
          plato_compartido_id: string
          plato_id: string | null
        }
        Insert: {
          creado_en?: string
          hogar_id?: string | null
          plato_compartido_id: string
          plato_id?: string | null
        }
        Update: {
          creado_en?: string
          hogar_id?: string | null
          plato_compartido_id?: string
          plato_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plato_compartido_autor_hogar_id_fkey"
            columns: ["hogar_id"]
            isOneToOne: false
            referencedRelation: "hogar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plato_compartido_autor_plato_compartido_id_fkey"
            columns: ["plato_compartido_id"]
            isOneToOne: true
            referencedRelation: "plato_compartido"
            referencedColumns: ["id"]
          },
        ]
      }
      plato_compartido_ingrediente: {
        Row: {
          cantidad_por_racion: number
          ingrediente_id: string
          opcional: boolean
          plato_compartido_id: string
        }
        Insert: {
          cantidad_por_racion: number
          ingrediente_id: string
          opcional?: boolean
          plato_compartido_id: string
        }
        Update: {
          cantidad_por_racion?: number
          ingrediente_id?: string
          opcional?: boolean
          plato_compartido_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plato_compartido_ingrediente_ingrediente_id_fkey"
            columns: ["ingrediente_id"]
            isOneToOne: false
            referencedRelation: "ingrediente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plato_compartido_ingrediente_plato_compartido_id_fkey"
            columns: ["plato_compartido_id"]
            isOneToOne: false
            referencedRelation: "plato_compartido"
            referencedColumns: ["id"]
          },
        ]
      }
      plato_ingrediente: {
        Row: {
          cantidad_por_racion: number
          hogar_id: string
          ingrediente_id: string
          opcional: boolean
          plato_id: string
        }
        Insert: {
          cantidad_por_racion: number
          hogar_id: string
          ingrediente_id: string
          opcional?: boolean
          plato_id: string
        }
        Update: {
          cantidad_por_racion?: number
          hogar_id?: string
          ingrediente_id?: string
          opcional?: boolean
          plato_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plato_ingrediente_ingrediente_id_fkey"
            columns: ["ingrediente_id"]
            isOneToOne: false
            referencedRelation: "ingrediente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plato_ingrediente_plato_id_hogar_id_fkey"
            columns: ["plato_id", "hogar_id"]
            isOneToOne: false
            referencedRelation: "plato"
            referencedColumns: ["id", "hogar_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adoptar_plato_compartido: {
        Args: { p_hogar_id: string; p_plato_compartido_id: string }
        Returns: string
      }
      bandeja_revision: {
        Args: never
        Returns: {
          alias_autor: string
          avisos: string[]
          enviado_en: string
          etiquetas: string[]
          grupo: unknown
          id: string
          ingredientes: Json
          nombre: string
          pasos: string
          rol: string
          tiempo_activo_min: number
          tiempo_total_min: number
        }[]
      }
      crear_centro: {
        Args: { p_hogar_id: string; p_localidad?: string; p_nombre: string }
        Returns: string
      }
      crear_codigo_centro: {
        Args: { p_centro_id: string; p_dias?: number; p_max_usos?: number }
        Returns: string
      }
      crear_hogar: { Args: { p_nombre: string }; Returns: string }
      crear_ingrediente: {
        Args: { p_nombre: string; p_seccion?: string; p_unidad: string }
        Returns: string
      }
      crear_invitacion: {
        Args: { p_hogar_id: string; p_rol?: string }
        Returns: string
      }
      enviar_plato_a_catalogo: {
        Args: { p_alias?: string; p_plato_id: string }
        Returns: string
      }
      revisar_plato_compartido: {
        Args: { p_decision: string; p_id: string; p_motivo?: string }
        Returns: undefined
      }
      unirse_a_centro: {
        Args: { p_codigo: string; p_hogar_id: string }
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
