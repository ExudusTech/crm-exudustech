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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      email_attachments: {
        Row: {
          content_hash: string | null
          content_type: string | null
          created_at: string
          deleted_at: string | null
          email_message_id: string | null
          filename: string
          id: string
          lead_id: string | null
          size_bytes: number | null
          storage_path: string
        }
        Insert: {
          content_hash?: string | null
          content_type?: string | null
          created_at?: string
          deleted_at?: string | null
          email_message_id?: string | null
          filename: string
          id?: string
          lead_id?: string | null
          size_bytes?: number | null
          storage_path: string
        }
        Update: {
          content_hash?: string | null
          content_type?: string | null
          created_at?: string
          deleted_at?: string | null
          email_message_id?: string | null
          filename?: string
          id?: string
          lead_id?: string | null
          size_bytes?: number | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_attachments_email_message_id_fkey"
            columns: ["email_message_id"]
            isOneToOne: false
            referencedRelation: "email_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_attachments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      email_messages: {
        Row: {
          created_at: string
          direction: string
          html_body: string | null
          id: string
          lead_id: string | null
          message: string | null
          raw_data: Json | null
          resend_message_id: string | null
          subject: string | null
          timestamp: string
        }
        Insert: {
          created_at?: string
          direction?: string
          html_body?: string | null
          id?: string
          lead_id?: string | null
          message?: string | null
          raw_data?: Json | null
          resend_message_id?: string | null
          subject?: string | null
          timestamp?: string
        }
        Update: {
          created_at?: string
          direction?: string
          html_body?: string | null
          id?: string
          lead_id?: string | null
          message?: string | null
          raw_data?: Json | null
          resend_message_id?: string | null
          subject?: string | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notes: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          note: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          note: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          note?: string
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          ai_close_probability: number | null
          ai_diagnosis: string | null
          ai_diagnosis_reason: string | null
          ai_diagnosis_updated_at: string | null
          ai_next_step: string | null
          archived: boolean | null
          client_interaction_count: number | null
          created_at: string
          data_proximo_pagamento: string | null
          delivered_at: string | null
          description: string | null
          description_updated_at: string | null
          email: string | null
          email_inbound_count: number | null
          email_outbound_count: number | null
          emails: string[] | null
          ganho_at: string | null
          id: string
          is_recurring: boolean | null
          last_inbound_message: string | null
          last_inbound_message_at: string | null
          last_outbound_message: string | null
          last_outbound_message_at: string | null
          message: string | null
          moeda: string | null
          name: string
          negociacao_at: string | null
          origem: string | null
          perdido_at: string | null
          phone: string | null
          phones: string[] | null
          produto: string | null
          produzido_at: string | null
          profile_picture_url: string | null
          proposal_last_viewed_at: string | null
          proposal_sent_at: string | null
          proposal_url: string | null
          proposal_view_count: number | null
          publicidade_subtipo: string | null
          reopened_at: string | null
          source: string | null
          status: Database["public"]["Enums"]["lead_status"] | null
          suggested_followup: string | null
          unclassified: boolean | null
          updated_at: string | null
          valor: number | null
          valor_manually_edited: boolean | null
          valor_pago: number | null
          whatsapp_chat_lids: string[] | null
          whatsapp_inbound_count: number | null
          whatsapp_outbound_count: number | null
        }
        Insert: {
          ai_close_probability?: number | null
          ai_diagnosis?: string | null
          ai_diagnosis_reason?: string | null
          ai_diagnosis_updated_at?: string | null
          ai_next_step?: string | null
          archived?: boolean | null
          client_interaction_count?: number | null
          created_at?: string
          data_proximo_pagamento?: string | null
          delivered_at?: string | null
          description?: string | null
          description_updated_at?: string | null
          email?: string | null
          email_inbound_count?: number | null
          email_outbound_count?: number | null
          emails?: string[] | null
          ganho_at?: string | null
          id?: string
          is_recurring?: boolean | null
          last_inbound_message?: string | null
          last_inbound_message_at?: string | null
          last_outbound_message?: string | null
          last_outbound_message_at?: string | null
          message?: string | null
          moeda?: string | null
          name: string
          negociacao_at?: string | null
          origem?: string | null
          perdido_at?: string | null
          phone?: string | null
          phones?: string[] | null
          produto?: string | null
          produzido_at?: string | null
          profile_picture_url?: string | null
          proposal_last_viewed_at?: string | null
          proposal_sent_at?: string | null
          proposal_url?: string | null
          proposal_view_count?: number | null
          publicidade_subtipo?: string | null
          reopened_at?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          suggested_followup?: string | null
          unclassified?: boolean | null
          updated_at?: string | null
          valor?: number | null
          valor_manually_edited?: boolean | null
          valor_pago?: number | null
          whatsapp_chat_lids?: string[] | null
          whatsapp_inbound_count?: number | null
          whatsapp_outbound_count?: number | null
        }
        Update: {
          ai_close_probability?: number | null
          ai_diagnosis?: string | null
          ai_diagnosis_reason?: string | null
          ai_diagnosis_updated_at?: string | null
          ai_next_step?: string | null
          archived?: boolean | null
          client_interaction_count?: number | null
          created_at?: string
          data_proximo_pagamento?: string | null
          delivered_at?: string | null
          description?: string | null
          description_updated_at?: string | null
          email?: string | null
          email_inbound_count?: number | null
          email_outbound_count?: number | null
          emails?: string[] | null
          ganho_at?: string | null
          id?: string
          is_recurring?: boolean | null
          last_inbound_message?: string | null
          last_inbound_message_at?: string | null
          last_outbound_message?: string | null
          last_outbound_message_at?: string | null
          message?: string | null
          moeda?: string | null
          name?: string
          negociacao_at?: string | null
          origem?: string | null
          perdido_at?: string | null
          phone?: string | null
          phones?: string[] | null
          produto?: string | null
          produzido_at?: string | null
          profile_picture_url?: string | null
          proposal_last_viewed_at?: string | null
          proposal_sent_at?: string | null
          proposal_url?: string | null
          proposal_view_count?: number | null
          publicidade_subtipo?: string | null
          reopened_at?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          suggested_followup?: string | null
          unclassified?: boolean | null
          updated_at?: string | null
          valor?: number | null
          valor_manually_edited?: boolean | null
          valor_pago?: number | null
          whatsapp_chat_lids?: string[] | null
          whatsapp_inbound_count?: number | null
          whatsapp_outbound_count?: number | null
        }
        Relationships: []
      }
      prompt_templates: {
        Row: {
          custom_prompt: string
          id: string
          updated_at: string
        }
        Insert: {
          custom_prompt: string
          id: string
          updated_at?: string
        }
        Update: {
          custom_prompt?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          created_at: string
          direction: string
          id: string
          is_audio: boolean | null
          lead_id: string | null
          message: string | null
          phone: string
          raw_data: Json | null
          timestamp: string | null
        }
        Insert: {
          created_at?: string
          direction: string
          id?: string
          is_audio?: boolean | null
          lead_id?: string | null
          message?: string | null
          phone: string
          raw_data?: Json | null
          timestamp?: string | null
        }
        Update: {
          created_at?: string
          direction?: string
          id?: string
          is_audio?: boolean | null
          lead_id?: string | null
          message?: string | null
          phone?: string
          raw_data?: Json | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
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
      lead_status:
        | "em_negociacao"
        | "ganho"
        | "perdido"
        | "entregue"
        | "em_aberto"
        | "produzido"
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
    Enums: {
      lead_status: [
        "em_negociacao",
        "ganho",
        "perdido",
        "entregue",
        "em_aberto",
        "produzido",
      ],
    },
  },
} as const
