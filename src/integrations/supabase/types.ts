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
      audit_logs: {
        Row: {
          action_type: string
          created_at: string
          description: string | null
          entity_id: string | null
          entity_name: string
          id: string
          new_value: Json | null
          old_value: Json | null
          source: string
        }
        Insert: {
          action_type?: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_name: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          source?: string
        }
        Update: {
          action_type?: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_name?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          source?: string
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          bank: string | null
          committed_balance: number | null
          created_at: string
          current_balance: number | null
          id: string
          name: string
          notes: string | null
          status: Database["public"]["Enums"]["ceo_status"] | null
          updated_at: string
        }
        Insert: {
          bank?: string | null
          committed_balance?: number | null
          created_at?: string
          current_balance?: number | null
          id?: string
          name: string
          notes?: string | null
          status?: Database["public"]["Enums"]["ceo_status"] | null
          updated_at?: string
        }
        Update: {
          bank?: string | null
          committed_balance?: number | null
          created_at?: string
          current_balance?: number | null
          id?: string
          name?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["ceo_status"] | null
          updated_at?: string
        }
        Relationships: []
      }
      ceo_documents: {
        Row: {
          created_at: string
          doc_type: Database["public"]["Enums"]["document_type"]
          id: string
          initiative_id: string | null
          name: string
          notes: string | null
          organization_id: string | null
          product_id: string | null
          project_id: string | null
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          doc_type?: Database["public"]["Enums"]["document_type"]
          id?: string
          initiative_id?: string | null
          name: string
          notes?: string | null
          organization_id?: string | null
          product_id?: string | null
          project_id?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          doc_type?: Database["public"]["Enums"]["document_type"]
          id?: string
          initiative_id?: string | null
          name?: string
          notes?: string | null
          organization_id?: string | null
          product_id?: string | null
          project_id?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ceo_documents_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ceo_events: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          event_date: string
          id: string
          initiative_id: string | null
          location: string | null
          notes: string | null
          project_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          event_date: string
          id?: string
          initiative_id?: string | null
          location?: string | null
          notes?: string | null
          project_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          event_date?: string
          id?: string
          initiative_id?: string | null
          location?: string | null
          notes?: string | null
          project_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ceo_events_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ceo_tasks: {
        Row: {
          created_at: string
          deadline: string | null
          dependency: string | null
          description: string | null
          id: string
          initiative_id: string | null
          notes: string | null
          priority: Database["public"]["Enums"]["priority_level"] | null
          project_id: string | null
          responsible: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          dependency?: string | null
          description?: string | null
          id?: string
          initiative_id?: string | null
          notes?: string | null
          priority?: Database["public"]["Enums"]["priority_level"] | null
          project_id?: string | null
          responsible?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deadline?: string | null
          dependency?: string | null
          description?: string | null
          id?: string
          initiative_id?: string | null
          notes?: string | null
          priority?: Database["public"]["Enums"]["priority_level"] | null
          project_id?: string | null
          responsible?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ceo_tasks_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_requests: {
        Row: {
          channel: string
          created_at: string
          executed_at: string | null
          execution_result: string | null
          id: string
          message_body: string | null
          message_subject: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          requested_by: string | null
          source_module: string
          status: string | null
          target_email: string | null
          target_name: string | null
          target_phone: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          executed_at?: string | null
          execution_result?: string | null
          id?: string
          message_body?: string | null
          message_subject?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          requested_by?: string | null
          source_module?: string
          status?: string | null
          target_email?: string | null
          target_name?: string | null
          target_phone?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          executed_at?: string | null
          execution_result?: string | null
          id?: string
          message_body?: string | null
          message_subject?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          requested_by?: string | null
          source_module?: string
          status?: string | null
          target_email?: string | null
          target_name?: string | null
          target_phone?: string | null
        }
        Relationships: []
      }
      cost_centers: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      credentials_refs: {
        Row: {
          created_at: string
          credential_type: string | null
          id: string
          infrastructure_id: string | null
          name: string
          notes: string | null
          reference_hint: string | null
          service: string
          updated_at: string
          vault_key: string | null
        }
        Insert: {
          created_at?: string
          credential_type?: string | null
          id?: string
          infrastructure_id?: string | null
          name: string
          notes?: string | null
          reference_hint?: string | null
          service: string
          updated_at?: string
          vault_key?: string | null
        }
        Update: {
          created_at?: string
          credential_type?: string | null
          id?: string
          infrastructure_id?: string | null
          name?: string
          notes?: string | null
          reference_hint?: string | null
          service?: string
          updated_at?: string
          vault_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credentials_refs_infrastructure_id_fkey"
            columns: ["infrastructure_id"]
            isOneToOne: false
            referencedRelation: "infrastructures"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_cards: {
        Row: {
          bank_account_id: string | null
          created_at: string
          due_day: number | null
          id: string
          name: string
          notes: string | null
          status: Database["public"]["Enums"]["ceo_status"] | null
          total_limit: number | null
          updated_at: string
          used_limit: number | null
        }
        Insert: {
          bank_account_id?: string | null
          created_at?: string
          due_day?: number | null
          id?: string
          name: string
          notes?: string | null
          status?: Database["public"]["Enums"]["ceo_status"] | null
          total_limit?: number | null
          updated_at?: string
          used_limit?: number | null
        }
        Update: {
          bank_account_id?: string | null
          created_at?: string
          due_day?: number | null
          id?: string
          name?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["ceo_status"] | null
          total_limit?: number | null
          updated_at?: string
          used_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_cards_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          created_at: string
          decided_at: string
          decided_by: string | null
          description: string | null
          id: string
          impact: string | null
          initiative_id: string | null
          notes: string | null
          title: string
        }
        Insert: {
          created_at?: string
          decided_at?: string
          decided_by?: string | null
          description?: string | null
          id?: string
          impact?: string | null
          initiative_id?: string | null
          notes?: string | null
          title: string
        }
        Update: {
          created_at?: string
          decided_at?: string
          decided_by?: string | null
          description?: string | null
          id?: string
          impact?: string | null
          initiative_id?: string | null
          notes?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "decisions_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
        ]
      }
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
      expenses: {
        Row: {
          amount: number | null
          category: string | null
          cost_center_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          initiative_id: string | null
          notes: string | null
          paid_date: string | null
          payment_method: string | null
          product_id: string | null
          project_id: string | null
          recurrence: Database["public"]["Enums"]["recurrence_type"] | null
          status: Database["public"]["Enums"]["financial_status"] | null
          supplier: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          category?: string | null
          cost_center_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          initiative_id?: string | null
          notes?: string | null
          paid_date?: string | null
          payment_method?: string | null
          product_id?: string | null
          project_id?: string | null
          recurrence?: Database["public"]["Enums"]["recurrence_type"] | null
          status?: Database["public"]["Enums"]["financial_status"] | null
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          category?: string | null
          cost_center_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          initiative_id?: string | null
          notes?: string | null
          paid_date?: string | null
          payment_method?: string | null
          product_id?: string | null
          project_id?: string | null
          recurrence?: Database["public"]["Enums"]["recurrence_type"] | null
          status?: Database["public"]["Enums"]["financial_status"] | null
          supplier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_obligations: {
        Row: {
          amount: number | null
          competence: string | null
          created_at: string
          due_date: string | null
          id: string
          notes: string | null
          obligation_type: string
          receipt_storage_path: string | null
          status: Database["public"]["Enums"]["financial_status"] | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          competence?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          obligation_type: string
          receipt_storage_path?: string | null
          status?: Database["public"]["Enums"]["financial_status"] | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          competence?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          obligation_type?: string
          receipt_storage_path?: string | null
          status?: Database["public"]["Enums"]["financial_status"] | null
          updated_at?: string
        }
        Relationships: []
      }
      google_connections: {
        Row: {
          access_token: string
          connected_at: string | null
          created_at: string | null
          email: string
          id: string
          last_sync_at: string | null
          refresh_token: string | null
          scopes: string[] | null
          status: string
          token_expires_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          connected_at?: string | null
          created_at?: string | null
          email: string
          id?: string
          last_sync_at?: string | null
          refresh_token?: string | null
          scopes?: string[] | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          connected_at?: string | null
          created_at?: string | null
          email?: string
          id?: string
          last_sync_at?: string | null
          refresh_token?: string | null
          scopes?: string[] | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      google_sync_logs: {
        Row: {
          action: string
          connection_id: string | null
          created_at: string | null
          details: string | null
          id: string
          initiative_id: string | null
          service: string
          status: string | null
        }
        Insert: {
          action: string
          connection_id?: string | null
          created_at?: string | null
          details?: string | null
          id?: string
          initiative_id?: string | null
          service: string
          status?: string | null
        }
        Update: {
          action?: string
          connection_id?: string | null
          created_at?: string | null
          details?: string | null
          id?: string
          initiative_id?: string | null
          service?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_sync_logs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "google_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_sync_logs_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
        ]
      }
      infrastructures: {
        Row: {
          assets: string | null
          base_prompts: string | null
          created_at: string
          environments: string | null
          functional_docs_url: string | null
          github_url: string | null
          id: string
          initiative_id: string | null
          integrations: string | null
          linked_accounts: string | null
          linked_emails: string | null
          name: string
          notes: string | null
          product_id: string | null
          project_id: string | null
          reusable_modules: string | null
          stack: string | null
          technical_docs_url: string | null
          updated_at: string
          url_production: string | null
          url_staging: string | null
        }
        Insert: {
          assets?: string | null
          base_prompts?: string | null
          created_at?: string
          environments?: string | null
          functional_docs_url?: string | null
          github_url?: string | null
          id?: string
          initiative_id?: string | null
          integrations?: string | null
          linked_accounts?: string | null
          linked_emails?: string | null
          name: string
          notes?: string | null
          product_id?: string | null
          project_id?: string | null
          reusable_modules?: string | null
          stack?: string | null
          technical_docs_url?: string | null
          updated_at?: string
          url_production?: string | null
          url_staging?: string | null
        }
        Update: {
          assets?: string | null
          base_prompts?: string | null
          created_at?: string
          environments?: string | null
          functional_docs_url?: string | null
          github_url?: string | null
          id?: string
          initiative_id?: string | null
          integrations?: string | null
          linked_accounts?: string | null
          linked_emails?: string | null
          name?: string
          notes?: string | null
          product_id?: string | null
          project_id?: string | null
          reusable_modules?: string | null
          stack?: string | null
          technical_docs_url?: string | null
          updated_at?: string
          url_production?: string | null
          url_staging?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "infrastructures_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "infrastructures_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "infrastructures_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      initiative_actions: {
        Row: {
          action_type: string
          conversation_id: string | null
          created_at: string
          description: string
          id: string
          initiative_id: string
          interpretation_id: string | null
          result_entity_id: string | null
          result_entity_type: string | null
          status: string
        }
        Insert: {
          action_type?: string
          conversation_id?: string | null
          created_at?: string
          description: string
          id?: string
          initiative_id: string
          interpretation_id?: string | null
          result_entity_id?: string | null
          result_entity_type?: string | null
          status?: string
        }
        Update: {
          action_type?: string
          conversation_id?: string | null
          created_at?: string
          description?: string
          id?: string
          initiative_id?: string
          interpretation_id?: string | null
          result_entity_id?: string | null
          result_entity_type?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "initiative_actions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "initiative_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "initiative_actions_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "initiative_actions_interpretation_id_fkey"
            columns: ["interpretation_id"]
            isOneToOne: false
            referencedRelation: "initiative_interpretations"
            referencedColumns: ["id"]
          },
        ]
      }
      initiative_conversations: {
        Row: {
          author: string | null
          content: string
          created_at: string
          id: string
          initiative_id: string
          mentioned_entities: Json | null
          raw_ai_response: string | null
          raw_user_message: string | null
          source: string
        }
        Insert: {
          author?: string | null
          content: string
          created_at?: string
          id?: string
          initiative_id: string
          mentioned_entities?: Json | null
          raw_ai_response?: string | null
          raw_user_message?: string | null
          source?: string
        }
        Update: {
          author?: string | null
          content?: string
          created_at?: string
          id?: string
          initiative_id?: string
          mentioned_entities?: Json | null
          raw_ai_response?: string | null
          raw_user_message?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "initiative_conversations_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
        ]
      }
      initiative_drive_links: {
        Row: {
          created_at: string | null
          drive_folder_id: string | null
          drive_folder_name: string | null
          drive_folder_url: string | null
          id: string
          initiative_id: string
          link_type: string | null
        }
        Insert: {
          created_at?: string | null
          drive_folder_id?: string | null
          drive_folder_name?: string | null
          drive_folder_url?: string | null
          id?: string
          initiative_id: string
          link_type?: string | null
        }
        Update: {
          created_at?: string | null
          drive_folder_id?: string | null
          drive_folder_name?: string | null
          drive_folder_url?: string | null
          id?: string
          initiative_id?: string
          link_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "initiative_drive_links_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
        ]
      }
      initiative_gaps: {
        Row: {
          conversation_id: string | null
          created_at: string
          description: string
          id: string
          initiative_id: string
          resolved: boolean
          resolved_action_id: string | null
          resolved_at: string | null
          severity: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          description: string
          id?: string
          initiative_id: string
          resolved?: boolean
          resolved_action_id?: string | null
          resolved_at?: string | null
          severity?: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          description?: string
          id?: string
          initiative_id?: string
          resolved?: boolean
          resolved_action_id?: string | null
          resolved_at?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "initiative_gaps_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "initiative_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "initiative_gaps_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "initiative_gaps_resolved_action_id_fkey"
            columns: ["resolved_action_id"]
            isOneToOne: false
            referencedRelation: "initiative_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      initiative_history: {
        Row: {
          author: string | null
          content: string
          conversation_id: string | null
          created_at: string
          entry_type: string
          id: string
          initiative_id: string
          source: string | null
          title: string | null
        }
        Insert: {
          author?: string | null
          content: string
          conversation_id?: string | null
          created_at?: string
          entry_type?: string
          id?: string
          initiative_id: string
          source?: string | null
          title?: string | null
        }
        Update: {
          author?: string | null
          content?: string
          conversation_id?: string | null
          created_at?: string
          entry_type?: string
          id?: string
          initiative_id?: string
          source?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "initiative_history_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "initiative_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "initiative_history_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
        ]
      }
      initiative_interpretations: {
        Row: {
          confidence: number | null
          conversation_id: string | null
          created_at: string
          detected_entities: Json | null
          detected_intent: string | null
          detected_themes: Json | null
          id: string
          initiative_id: string
          notes: string | null
          suggested_actions: Json | null
        }
        Insert: {
          confidence?: number | null
          conversation_id?: string | null
          created_at?: string
          detected_entities?: Json | null
          detected_intent?: string | null
          detected_themes?: Json | null
          id?: string
          initiative_id: string
          notes?: string | null
          suggested_actions?: Json | null
        }
        Update: {
          confidence?: number | null
          conversation_id?: string | null
          created_at?: string
          detected_entities?: Json | null
          detected_intent?: string | null
          detected_themes?: Json | null
          id?: string
          initiative_id?: string
          notes?: string | null
          suggested_actions?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "initiative_interpretations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "initiative_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "initiative_interpretations_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
        ]
      }
      initiative_stakeholders: {
        Row: {
          created_at: string
          id: string
          initiative_id: string
          role: string | null
          stakeholder_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          initiative_id: string
          role?: string | null
          stakeholder_id: string
        }
        Update: {
          created_at?: string
          id?: string
          initiative_id?: string
          role?: string | null
          stakeholder_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "initiative_stakeholders_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "initiative_stakeholders_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      initiatives: {
        Row: {
          created_at: string
          deadline: string | null
          description: string | null
          id: string
          main_risk: string | null
          name: string
          next_action: string | null
          organization_id: string | null
          partner_organization_id: string | null
          pilot_organization_id: string | null
          potential: string | null
          priority: Database["public"]["Enums"]["priority_level"] | null
          short_name: string | null
          status: Database["public"]["Enums"]["ceo_status"]
          strategic_asset_id: string | null
          strategic_notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          main_risk?: string | null
          name: string
          next_action?: string | null
          organization_id?: string | null
          partner_organization_id?: string | null
          pilot_organization_id?: string | null
          potential?: string | null
          priority?: Database["public"]["Enums"]["priority_level"] | null
          short_name?: string | null
          status?: Database["public"]["Enums"]["ceo_status"]
          strategic_asset_id?: string | null
          strategic_notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          main_risk?: string | null
          name?: string
          next_action?: string | null
          organization_id?: string | null
          partner_organization_id?: string | null
          pilot_organization_id?: string | null
          potential?: string | null
          priority?: Database["public"]["Enums"]["priority_level"] | null
          short_name?: string | null
          status?: Database["public"]["Enums"]["ceo_status"]
          strategic_asset_id?: string | null
          strategic_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "initiatives_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "initiatives_partner_organization_id_fkey"
            columns: ["partner_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "initiatives_pilot_organization_id_fkey"
            columns: ["pilot_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "initiatives_strategic_asset_id_fkey"
            columns: ["strategic_asset_id"]
            isOneToOne: false
            referencedRelation: "strategic_assets"
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
      lessons_learned: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          initiative_id: string | null
          lesson_date: string | null
          notes: string | null
          project_id: string | null
          title: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          initiative_id?: string | null
          lesson_date?: string | null
          notes?: string | null
          project_id?: string | null
          title: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          initiative_id?: string | null
          lesson_date?: string | null
          notes?: string | null
          project_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_learned_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_learned_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      module_usages: {
        Row: {
          adaptation_notes: string | null
          created_at: string
          id: string
          module_id: string
          used_in_initiative_id: string | null
          used_in_project_id: string | null
        }
        Insert: {
          adaptation_notes?: string | null
          created_at?: string
          id?: string
          module_id: string
          used_in_initiative_id?: string | null
          used_in_project_id?: string | null
        }
        Update: {
          adaptation_notes?: string | null
          created_at?: string
          id?: string
          module_id?: string
          used_in_initiative_id?: string | null
          used_in_project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "module_usages_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_usages_used_in_initiative_id_fkey"
            columns: ["used_in_initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_usages_used_in_project_id_fkey"
            columns: ["used_in_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          created_at: string
          description: string | null
          documentation_url: string | null
          has_billing_layer: boolean | null
          id: string
          name: string
          notes: string | null
          origin_product_id: string | null
          pluggability_score: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          documentation_url?: string | null
          has_billing_layer?: boolean | null
          id?: string
          name: string
          notes?: string | null
          origin_product_id?: string | null
          pluggability_score?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          documentation_url?: string | null
          has_billing_layer?: boolean | null
          id?: string
          name?: string
          notes?: string | null
          origin_product_id?: string | null
          pluggability_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_origin_product_id_fkey"
            columns: ["origin_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          parent_organization_id: string | null
          segment: string | null
          short_name: string | null
          status: Database["public"]["Enums"]["ceo_status"]
          type: Database["public"]["Enums"]["organization_type"]
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          parent_organization_id?: string | null
          segment?: string | null
          short_name?: string | null
          status?: Database["public"]["Enums"]["ceo_status"]
          type?: Database["public"]["Enums"]["organization_type"]
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          parent_organization_id?: string | null
          segment?: string | null
          short_name?: string | null
          status?: Database["public"]["Enums"]["ceo_status"]
          type?: Database["public"]["Enums"]["organization_type"]
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_parent_organization_id_fkey"
            columns: ["parent_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          benchmark: string | null
          category: string | null
          commercial_model: string | null
          created_at: string
          description: string | null
          id: string
          modularity_notes: string | null
          name: string
          notes: string | null
          pilot_organization_id: string | null
          price: number | null
          status: Database["public"]["Enums"]["ceo_status"]
          updated_at: string
          value_message: string | null
        }
        Insert: {
          benchmark?: string | null
          category?: string | null
          commercial_model?: string | null
          created_at?: string
          description?: string | null
          id?: string
          modularity_notes?: string | null
          name: string
          notes?: string | null
          pilot_organization_id?: string | null
          price?: number | null
          status?: Database["public"]["Enums"]["ceo_status"]
          updated_at?: string
          value_message?: string | null
        }
        Update: {
          benchmark?: string | null
          category?: string | null
          commercial_model?: string | null
          created_at?: string
          description?: string | null
          id?: string
          modularity_notes?: string | null
          name?: string
          notes?: string | null
          pilot_organization_id?: string | null
          price?: number | null
          status?: Database["public"]["Enums"]["ceo_status"]
          updated_at?: string
          value_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_pilot_organization_id_fkey"
            columns: ["pilot_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          initiative_id: string | null
          main_risk: string | null
          name: string
          next_action: string | null
          notes: string | null
          priority: Database["public"]["Enums"]["priority_level"] | null
          product_id: string | null
          responsible: string | null
          scope_summary: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["ceo_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          initiative_id?: string | null
          main_risk?: string | null
          name: string
          next_action?: string | null
          notes?: string | null
          priority?: Database["public"]["Enums"]["priority_level"] | null
          product_id?: string | null
          responsible?: string | null
          scope_summary?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["ceo_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          initiative_id?: string | null
          main_risk?: string | null
          name?: string
          next_action?: string | null
          notes?: string | null
          priority?: Database["public"]["Enums"]["priority_level"] | null
          product_id?: string | null
          responsible?: string | null
          scope_summary?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["ceo_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
      revenues: {
        Row: {
          cost_center_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          expected_amount: number | null
          id: string
          initiative_id: string | null
          invoice_number: string | null
          notes: string | null
          organization_id: string | null
          payment_method: string | null
          product_id: string | null
          project_id: string | null
          received_amount: number | null
          received_date: string | null
          status: Database["public"]["Enums"]["financial_status"] | null
          updated_at: string
        }
        Insert: {
          cost_center_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          expected_amount?: number | null
          id?: string
          initiative_id?: string | null
          invoice_number?: string | null
          notes?: string | null
          organization_id?: string | null
          payment_method?: string | null
          product_id?: string | null
          project_id?: string | null
          received_amount?: number | null
          received_date?: string | null
          status?: Database["public"]["Enums"]["financial_status"] | null
          updated_at?: string
        }
        Update: {
          cost_center_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          expected_amount?: number | null
          id?: string
          initiative_id?: string | null
          invoice_number?: string | null
          notes?: string | null
          organization_id?: string | null
          payment_method?: string | null
          product_id?: string | null
          project_id?: string | null
          received_amount?: number | null
          received_date?: string | null
          status?: Database["public"]["Enums"]["financial_status"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenues_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenues_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenues_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenues_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      stakeholders: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string | null
          phone: string | null
          role_title: string | null
          stakeholder_type: Database["public"]["Enums"]["stakeholder_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          role_title?: string | null
          stakeholder_type?: Database["public"]["Enums"]["stakeholder_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          role_title?: string | null
          stakeholder_type?: Database["public"]["Enums"]["stakeholder_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stakeholders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      strategic_assets: {
        Row: {
          asset_type: Database["public"]["Enums"]["strategic_asset_type"]
          created_at: string
          deadline: string | null
          description: string | null
          id: string
          main_risk: string | null
          name: string
          next_action: string | null
          organization_id: string | null
          partner_organization_id: string | null
          pilot_organization_id: string | null
          potential: string | null
          priority: Database["public"]["Enums"]["priority_level"] | null
          short_name: string | null
          status: Database["public"]["Enums"]["ceo_status"]
          strategic_notes: string | null
          updated_at: string
        }
        Insert: {
          asset_type?: Database["public"]["Enums"]["strategic_asset_type"]
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          main_risk?: string | null
          name: string
          next_action?: string | null
          organization_id?: string | null
          partner_organization_id?: string | null
          pilot_organization_id?: string | null
          potential?: string | null
          priority?: Database["public"]["Enums"]["priority_level"] | null
          short_name?: string | null
          status?: Database["public"]["Enums"]["ceo_status"]
          strategic_notes?: string | null
          updated_at?: string
        }
        Update: {
          asset_type?: Database["public"]["Enums"]["strategic_asset_type"]
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          main_risk?: string | null
          name?: string
          next_action?: string | null
          organization_id?: string | null
          partner_organization_id?: string | null
          pilot_organization_id?: string | null
          potential?: string | null
          priority?: Database["public"]["Enums"]["priority_level"] | null
          short_name?: string | null
          status?: Database["public"]["Enums"]["ceo_status"]
          strategic_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategic_assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_assets_partner_organization_id_fkey"
            columns: ["partner_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_assets_pilot_organization_id_fkey"
            columns: ["pilot_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          annual_amount: number | null
          billing_day: number | null
          category: string | null
          created_at: string
          criticality: Database["public"]["Enums"]["priority_level"] | null
          id: string
          monthly_amount: number | null
          notes: string | null
          payment_method: string | null
          service_name: string
          status: Database["public"]["Enums"]["ceo_status"] | null
          updated_at: string
        }
        Insert: {
          annual_amount?: number | null
          billing_day?: number | null
          category?: string | null
          created_at?: string
          criticality?: Database["public"]["Enums"]["priority_level"] | null
          id?: string
          monthly_amount?: number | null
          notes?: string | null
          payment_method?: string | null
          service_name: string
          status?: Database["public"]["Enums"]["ceo_status"] | null
          updated_at?: string
        }
        Update: {
          annual_amount?: number | null
          billing_day?: number | null
          category?: string | null
          created_at?: string
          criticality?: Database["public"]["Enums"]["priority_level"] | null
          id?: string
          monthly_amount?: number | null
          notes?: string | null
          payment_method?: string | null
          service_name?: string
          status?: Database["public"]["Enums"]["ceo_status"] | null
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
      ceo_status:
        | "ativo"
        | "pausado"
        | "concluido"
        | "cancelado"
        | "em_analise"
        | "arquivado"
        | "em_andamento"
        | "em_validacao"
        | "incubando"
        | "esfriado"
        | "aguardando_retorno"
        | "entregue"
        | "articulacao_estrategica"
        | "adquirido_nao_implantado"
        | "bloqueado"
      document_type:
        | "contrato"
        | "proposta"
        | "apresentacao"
        | "relatorio"
        | "parecer"
        | "nota_fiscal"
        | "documento_fiscal"
        | "extrato"
        | "gravacao"
        | "material_marketing"
        | "print"
        | "anexo_tecnico"
        | "outro"
      financial_status:
        | "pendente"
        | "pago"
        | "recebido"
        | "atrasado"
        | "cancelado"
        | "parcial"
      lead_status:
        | "em_negociacao"
        | "ganho"
        | "perdido"
        | "entregue"
        | "em_aberto"
        | "produzido"
      organization_type:
        | "cliente"
        | "parceiro"
        | "piloto"
        | "instituicao"
        | "organizacao_mae"
        | "unidade"
        | "interno"
        | "loja"
        | "prestador_servico"
      priority_level: "critica" | "alta" | "media" | "baixa"
      recurrence_type:
        | "mensal"
        | "trimestral"
        | "semestral"
        | "anual"
        | "avulso"
      stakeholder_type:
        | "decisor"
        | "operacional"
        | "tecnico"
        | "comercial"
        | "aprovador"
        | "consultor"
        | "outro"
      strategic_asset_type:
        | "ideia"
        | "oportunidade"
        | "sistema"
        | "agente"
        | "produto"
        | "framework"
        | "ativo_adquirido"
        | "ativo_conhecimento"
      task_status:
        | "todo"
        | "doing"
        | "done"
        | "bloqueado"
        | "aguardando_terceiro"
        | "pausado"
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
      ceo_status: [
        "ativo",
        "pausado",
        "concluido",
        "cancelado",
        "em_analise",
        "arquivado",
        "em_andamento",
        "em_validacao",
        "incubando",
        "esfriado",
        "aguardando_retorno",
        "entregue",
        "articulacao_estrategica",
        "adquirido_nao_implantado",
        "bloqueado",
      ],
      document_type: [
        "contrato",
        "proposta",
        "apresentacao",
        "relatorio",
        "parecer",
        "nota_fiscal",
        "documento_fiscal",
        "extrato",
        "gravacao",
        "material_marketing",
        "print",
        "anexo_tecnico",
        "outro",
      ],
      financial_status: [
        "pendente",
        "pago",
        "recebido",
        "atrasado",
        "cancelado",
        "parcial",
      ],
      lead_status: [
        "em_negociacao",
        "ganho",
        "perdido",
        "entregue",
        "em_aberto",
        "produzido",
      ],
      organization_type: [
        "cliente",
        "parceiro",
        "piloto",
        "instituicao",
        "organizacao_mae",
        "unidade",
        "interno",
        "loja",
        "prestador_servico",
      ],
      priority_level: ["critica", "alta", "media", "baixa"],
      recurrence_type: ["mensal", "trimestral", "semestral", "anual", "avulso"],
      stakeholder_type: [
        "decisor",
        "operacional",
        "tecnico",
        "comercial",
        "aprovador",
        "consultor",
        "outro",
      ],
      strategic_asset_type: [
        "ideia",
        "oportunidade",
        "sistema",
        "agente",
        "produto",
        "framework",
        "ativo_adquirido",
        "ativo_conhecimento",
      ],
      task_status: [
        "todo",
        "doing",
        "done",
        "bloqueado",
        "aguardando_terceiro",
        "pausado",
      ],
    },
  },
} as const
