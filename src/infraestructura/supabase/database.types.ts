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
      hogar_calendario: {
        Row: {
          creado_en: string
          creado_por: string | null
          hogar_id: string
          token: string
        }
        Insert: {
          creado_en?: string
          creado_por?: string | null
          hogar_id: string
          token: string
        }
        Update: {
          creado_en?: string
          creado_por?: string | null
          hogar_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "hogar_calendario_hogar_id_fkey"
            columns: ["hogar_id"]
            isOneToOne: true
            referencedRelation: "hogar"
            referencedColumns: ["id"]
          },
        ]
      }
      hogar_estado: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          estado: Json
          hogar_id: string
          version: number
        }
        Insert: never
        Update: never
        Relationships: []
      }
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
      carga: {
        Row: {
          activa: boolean
          creado_en: string
          esfuerzo_min: number
          frecuencia: string
          hogar_id: string
          id: string
          nombre: string
          planificacion_min: number
          responsable_id: string | null
          tipo: string
        }
        Insert: {
          activa?: boolean
          creado_en?: string
          esfuerzo_min: number
          frecuencia?: string
          hogar_id: string
          id?: string
          nombre: string
          planificacion_min?: number
          responsable_id?: string | null
          tipo: string
        }
        Update: {
          activa?: boolean
          creado_en?: string
          esfuerzo_min?: number
          frecuencia?: string
          hogar_id?: string
          id?: string
          nombre?: string
          planificacion_min?: number
          responsable_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "carga_hogar_id_fkey"
            columns: ["hogar_id"]
            isOneToOne: false
            referencedRelation: "hogar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carga_responsable_id_hogar_id_fkey"
            columns: ["responsable_id", "hogar_id"]
            isOneToOne: false
            referencedRelation: "persona"
            referencedColumns: ["id", "hogar_id"]
          },
        ]
      }
      carga_turno: {
        Row: {
          carga_id: string
          estado: string
          fecha: string
          hecho_en: string | null
          hogar_id: string
          persona_id: string
        }
        Insert: {
          carga_id: string
          estado?: string
          fecha: string
          hecho_en?: string | null
          hogar_id: string
          persona_id: string
        }
        Update: {
          carga_id?: string
          estado?: string
          fecha?: string
          hecho_en?: string | null
          hogar_id?: string
          persona_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carga_turno_carga_id_hogar_id_fkey"
            columns: ["carga_id", "hogar_id"]
            isOneToOne: false
            referencedRelation: "carga"
            referencedColumns: ["id", "hogar_id"]
          },
          {
            foreignKeyName: "carga_turno_persona_id_hogar_id_fkey"
            columns: ["persona_id", "hogar_id"]
            isOneToOne: false
            referencedRelation: "persona"
            referencedColumns: ["id", "hogar_id"]
          },
        ]
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
      despensa_item: {
        Row: {
          actualizado_en: string
          caduca_en: string | null
          cantidad: number
          hogar_id: string
          id: string
          ingrediente_id: string
          minimo: number | null
          ubicacion: string
        }
        Insert: {
          actualizado_en?: string
          caduca_en?: string | null
          cantidad?: number
          hogar_id: string
          id?: string
          ingrediente_id: string
          minimo?: number | null
          ubicacion: string
        }
        Update: {
          actualizado_en?: string
          caduca_en?: string | null
          cantidad?: number
          hogar_id?: string
          id?: string
          ingrediente_id?: string
          minimo?: number | null
          ubicacion?: string
        }
        Relationships: [
          {
            foreignKeyName: "despensa_item_hogar_id_fkey"
            columns: ["hogar_id"]
            isOneToOne: false
            referencedRelation: "hogar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despensa_item_ingrediente_id_fkey"
            columns: ["ingrediente_id"]
            isOneToOne: false
            referencedRelation: "ingrediente"
            referencedColumns: ["id"]
          },
        ]
      }
      despensa_movimiento: {
        Row: {
          caduca_antes: string | null
          delta: number
          hogar_id: string
          id: number
          ingrediente_id: string
          operacion_id: string
          ubicacion: string
        }
        Insert: {
          caduca_antes?: string | null
          delta: number
          hogar_id: string
          id?: never
          ingrediente_id: string
          operacion_id: string
          ubicacion: string
        }
        Update: {
          caduca_antes?: string | null
          delta?: number
          hogar_id?: string
          id?: never
          ingrediente_id?: string
          operacion_id?: string
          ubicacion?: string
        }
        Relationships: [
          {
            foreignKeyName: "despensa_movimiento_ingrediente_id_fkey"
            columns: ["ingrediente_id"]
            isOneToOne: false
            referencedRelation: "ingrediente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despensa_movimiento_operacion_id_hogar_id_fkey"
            columns: ["operacion_id", "hogar_id"]
            isOneToOne: false
            referencedRelation: "despensa_operacion"
            referencedColumns: ["id", "hogar_id"]
          },
        ]
      }
      despensa_operacion: {
        Row: {
          articulo_id: string | null
          creada_en: string
          creada_por: string | null
          deshecha_en: string | null
          descripcion: string | null
          hogar_id: string
          id: string
          revierte_id: string | null
          tipo: string
        }
        Insert: {
          articulo_id?: string | null
          creada_en?: string
          creada_por?: string | null
          deshecha_en?: string | null
          descripcion?: string | null
          hogar_id: string
          id?: string
          revierte_id?: string | null
          tipo: string
        }
        Update: {
          articulo_id?: string | null
          creada_en?: string
          creada_por?: string | null
          deshecha_en?: string | null
          descripcion?: string | null
          hogar_id?: string
          id?: string
          revierte_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "despensa_operacion_hogar_id_fkey"
            columns: ["hogar_id"]
            isOneToOne: false
            referencedRelation: "hogar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despensa_operacion_revierte_id_fkey"
            columns: ["revierte_id"]
            isOneToOne: false
            referencedRelation: "despensa_operacion"
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
      lista_compra_articulo: {
        Row: {
          cantidad: number | null
          comprado: boolean
          comprado_en: string | null
          comprado_por: string | null
          creado_en: string
          creado_por: string | null
          hogar_id: string
          id: string
          ingrediente_id: string | null
          motivo: string | null
          nombre: string
          origen: string
          seccion: string
        }
        Insert: {
          cantidad?: number | null
          comprado?: boolean
          comprado_en?: string | null
          comprado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          hogar_id: string
          id?: string
          ingrediente_id?: string | null
          motivo?: string | null
          nombre: string
          origen?: string
          seccion?: string
        }
        Update: {
          cantidad?: number | null
          comprado?: boolean
          comprado_en?: string | null
          comprado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          hogar_id?: string
          id?: string
          ingrediente_id?: string | null
          motivo?: string | null
          nombre?: string
          origen?: string
          seccion?: string
        }
        Relationships: [
          {
            foreignKeyName: "lista_compra_articulo_hogar_id_fkey"
            columns: ["hogar_id"]
            isOneToOne: false
            referencedRelation: "hogar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lista_compra_articulo_ingrediente_id_fkey"
            columns: ["ingrediente_id"]
            isOneToOne: false
            referencedRelation: "ingrediente"
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
      aplicar_operacion_despensa: {
        Args: {
          p_descripcion: string
          p_hogar_id: string
          p_movimientos: Json
          p_tipo: string
        }
        Returns: string
      }
      deshacer_operacion_despensa: {
        Args: { p_operacion_id: string }
        Returns: string
      }
      marcar_comprado: {
        Args: { p_articulo_id: string; p_ubicacion?: string }
        Returns: string
      }
      sincronizar_compra_auto: {
        Args: { p_articulos: Json; p_hogar_id: string }
        Returns: number
      }
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
      estado_para_calendario: { Args: { p_token: string }; Returns: Json }
      guardar_estado_hogar: {
        Args: { p_hogar_id: string; p_version_esperada: number; p_estado: Json }
        Returns: number
      }
      crear_ingrediente: {
        Args: { p_nombre: string; p_seccion?: string; p_unidad: string }
        Returns: string
      }
      leer_cole_tablas: {
        Args: { p_hogar_id: string }
        Returns: Json
      }
      aplicar_cambios_cole: {
        Args: { p_hogar_id: string; p_cambios: Json }
        Returns: undefined
      }
      guardar_suscripcion_push: {
        Args: { p_hogar_id: string; p_endpoint: string; p_p256dh: string; p_auth: string }
        Returns: undefined
      }
      quitar_suscripcion_push: {
        Args: { p_endpoint: string }
        Returns: undefined
      }
      pedir_prueba_push: {
        Args: { p_hogar_id: string; p_endpoint: string }
        Returns: boolean
      }
      aplicar_cambios_registro: {
        Args: { p_hogar_id: string; p_cambios: Json }
        Returns: undefined
      }
      leer_registro_tablas: {
        Args: { p_hogar_id: string }
        Returns: Json
      }
      resolver_ingredientes: {
        Args: { p_ingredientes: Json }
        Returns: Json
      }
      leer_menu_tablas: {
        Args: { p_hogar_id: string }
        Returns: Json
      }
      aplicar_cambios_menu: {
        Args: { p_hogar_id: string; p_cambios: Json }
        Returns: undefined
      }
      usar_ia: {
        Args: { p_hogar_id: string }
        Returns: Json
      }
      crear_invitacion_persona: {
        Args: { p_hogar_id: string; p_persona_id: string }
        Returns: string
      }
      vincular_persona_propia: {
        Args: { p_hogar_id: string; p_persona_id: string }
        Returns: undefined
      }
      mi_persona: {
        Args: { p_hogar_id: string }
        Returns: string
      }
      leer_hogar_tablas: {
        Args: { p_hogar_id: string }
        Returns: Json
      }
      aplicar_cambios_tablas: {
        Args: { p_hogar_id: string; p_cambios: Json }
        Returns: undefined
      }
      crear_invitacion: {
        Args: { p_hogar_id: string; p_rol?: string }
        Returns: string
      }
      enlace_calendario: {
        Args: { p_hogar_id: string; p_renovar?: boolean }
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
