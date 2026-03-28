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
      appointment_services: {
        Row: {
          appointment_id: string
          duration_minutes: number
          id: string
          price: number
          service_id: string
        }
        Insert: {
          appointment_id: string
          duration_minutes: number
          id?: string
          price: number
          service_id: string
        }
        Update: {
          appointment_id?: string
          duration_minutes?: number
          id?: string
          price?: number
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_services_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          client_id: string | null
          client_name: string | null
          client_whatsapp: string | null
          company_id: string
          created_at: string
          end_time: string
          id: string
          notes: string | null
          professional_id: string
          start_time: string
          status: Database["public"]["Enums"]["appointment_status"]
          total_price: number
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          client_name?: string | null
          client_whatsapp?: string | null
          company_id: string
          created_at?: string
          end_time: string
          id?: string
          notes?: string | null
          professional_id: string
          start_time: string
          status?: Database["public"]["Enums"]["appointment_status"]
          total_price?: number
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          client_name?: string | null
          client_whatsapp?: string | null
          company_id?: string
          created_at?: string
          end_time?: string
          id?: string
          notes?: string | null
          professional_id?: string
          start_time?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_times: {
        Row: {
          block_date: string
          company_id: string
          created_at: string
          end_time: string
          id: string
          professional_id: string
          reason: string | null
          start_time: string
        }
        Insert: {
          block_date: string
          company_id: string
          created_at?: string
          end_time: string
          id?: string
          professional_id: string
          reason?: string | null
          start_time: string
        }
        Update: {
          block_date?: string
          company_id?: string
          created_at?: string
          end_time?: string
          id?: string
          professional_id?: string
          reason?: string | null
          start_time?: string
        }
        Relationships: []
      }
      business_exceptions: {
        Row: {
          close_time: string | null
          company_id: string
          created_at: string
          exception_date: string
          id: string
          is_closed: boolean
          open_time: string | null
          reason: string | null
        }
        Insert: {
          close_time?: string | null
          company_id: string
          created_at?: string
          exception_date: string
          id?: string
          is_closed?: boolean
          open_time?: string | null
          reason?: string | null
        }
        Update: {
          close_time?: string | null
          company_id?: string
          created_at?: string
          exception_date?: string
          id?: string
          is_closed?: boolean
          open_time?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_exceptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      business_hours: {
        Row: {
          close_time: string
          company_id: string
          day_of_week: number
          id: string
          is_closed: boolean
          lunch_end: string | null
          lunch_start: string | null
          open_time: string
        }
        Insert: {
          close_time: string
          company_id: string
          day_of_week: number
          id?: string
          is_closed?: boolean
          lunch_end?: string | null
          lunch_start?: string | null
          open_time: string
        }
        Update: {
          close_time?: string
          company_id?: string
          day_of_week?: number
          id?: string
          is_closed?: boolean
          lunch_end?: string | null
          lunch_start?: string | null
          open_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          company_id: string
          cpf: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          opt_in_whatsapp: boolean
          whatsapp: string | null
        }
        Insert: {
          company_id: string
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          opt_in_whatsapp?: boolean
          whatsapp?: string | null
        }
        Update: {
          company_id?: string
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          opt_in_whatsapp?: boolean
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborators: {
        Row: {
          active: boolean
          collaborator_type: Database["public"]["Enums"]["collaborator_type"]
          commission_percent: number | null
          commission_type: Database["public"]["Enums"]["commission_type"]
          commission_value: number
          company_id: string
          created_at: string
          id: string
          profile_id: string
          slug: string | null
        }
        Insert: {
          active?: boolean
          collaborator_type: Database["public"]["Enums"]["collaborator_type"]
          commission_percent?: number | null
          commission_type?: Database["public"]["Enums"]["commission_type"]
          commission_value?: number
          company_id: string
          created_at?: string
          id?: string
          profile_id: string
          slug?: string | null
        }
        Update: {
          active?: boolean
          collaborator_type?: Database["public"]["Enums"]["collaborator_type"]
          commission_percent?: number | null
          commission_type?: Database["public"]["Enums"]["commission_type"]
          commission_value?: number
          company_id?: string
          created_at?: string
          id?: string
          profile_id?: string
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collaborators_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborators_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborators_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          birthday_discount_type: string
          birthday_discount_value: number
          birthday_enabled: boolean
          buffer_minutes: number
          business_type: Database["public"]["Enums"]["business_type"]
          created_at: string
          id: string
          logo_url: string | null
          name: string
          owner_id: string | null
          phone: string | null
          reminders_enabled: boolean
          slug: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          birthday_discount_type?: string
          birthday_discount_value?: number
          birthday_enabled?: boolean
          buffer_minutes?: number
          business_type?: Database["public"]["Enums"]["business_type"]
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          owner_id?: string | null
          phone?: string | null
          reminders_enabled?: boolean
          slug: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          birthday_discount_type?: string
          birthday_discount_value?: number
          birthday_enabled?: boolean
          buffer_minutes?: number
          business_type?: Database["public"]["Enums"]["business_type"]
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          phone?: string | null
          reminders_enabled?: boolean
          slug?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          booking_buffer_minutes: number
          company_id: string
          created_at: string
          id: string
          logo_url: string | null
          primary_color: string
          secondary_color: string
          timezone: string
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          booking_buffer_minutes?: number
          company_id: string
          created_at?: string
          id?: string
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string
          timezone?: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          booking_buffer_minutes?: number
          company_id?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string
          timezone?: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_working_hours: {
        Row: {
          close_time: string
          company_id: string
          day_of_week: number
          id: string
          is_closed: boolean
          lunch_end: string | null
          lunch_start: string | null
          open_time: string
          professional_id: string
        }
        Insert: {
          close_time?: string
          company_id: string
          day_of_week: number
          id?: string
          is_closed?: boolean
          lunch_end?: string | null
          lunch_start?: string | null
          open_time?: string
          professional_id: string
        }
        Update: {
          close_time?: string
          company_id?: string
          day_of_week?: number
          id?: string
          is_closed?: boolean
          lunch_end?: string | null
          lunch_start?: string | null
          open_time?: string
          professional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_working_hours_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_working_hours_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_working_hours_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          average_return_days: number | null
          birth_date: string | null
          company_id: string | null
          created_at: string
          email: string | null
          expected_return_date: string | null
          full_name: string
          id: string
          last_visit_date: string | null
          opt_in_date: string | null
          opt_in_whatsapp: boolean
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          average_return_days?: number | null
          birth_date?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          expected_return_date?: string | null
          full_name: string
          id?: string
          last_visit_date?: string | null
          opt_in_date?: string | null
          opt_in_whatsapp?: boolean
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          average_return_days?: number | null
          birth_date?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          expected_return_date?: string | null
          full_name?: string
          id?: string
          last_visit_date?: string | null
          opt_in_date?: string | null
          opt_in_whatsapp?: boolean
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      service_professionals: {
        Row: {
          company_id: string | null
          id: string
          price_override: number | null
          professional_id: string
          service_id: string
        }
        Insert: {
          company_id?: string | null
          id?: string
          price_override?: number | null
          professional_id: string
          service_id: string
        }
        Update: {
          company_id?: string | null
          id?: string
          price_override?: number | null
          professional_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_professionals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_professionals_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_professionals_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_professionals_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_professionals_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          duration_minutes: number
          id: string
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          duration_minutes: number
          id?: string
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      waiting_list: {
        Row: {
          client_id: string
          company_id: string
          created_at: string
          desired_date: string
          id: string
          professional_id: string | null
          service_ids: string[]
          status: Database["public"]["Enums"]["waiting_list_status"]
        }
        Insert: {
          client_id: string
          company_id: string
          created_at?: string
          desired_date: string
          id?: string
          professional_id?: string | null
          service_ids: string[]
          status?: Database["public"]["Enums"]["waiting_list_status"]
        }
        Update: {
          client_id?: string
          company_id?: string
          created_at?: string
          desired_date?: string
          id?: string
          professional_id?: string | null
          service_ids?: string[]
          status?: Database["public"]["Enums"]["waiting_list_status"]
        }
        Relationships: [
          {
            foreignKeyName: "waiting_list_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_list_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_list_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_list_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_list_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          client_id: string
          company_id: string
          created_at: string
          desired_date: string
          id: string
          notified: boolean
          service_ids: string[]
        }
        Insert: {
          client_id: string
          company_id: string
          created_at?: string
          desired_date: string
          id?: string
          notified?: boolean
          service_ids: string[]
        }
        Update: {
          client_id?: string
          company_id?: string
          created_at?: string
          desired_date?: string
          id?: string
          notified?: boolean
          service_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_configs: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          event_type: Database["public"]["Enums"]["webhook_event_type"]
          id: string
          url: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          event_type: Database["public"]["Enums"]["webhook_event_type"]
          id?: string
          url: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          event_type?: Database["public"]["Enums"]["webhook_event_type"]
          id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_configs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          company_id: string
          created_at: string
          event_type: Database["public"]["Enums"]["webhook_event_type"]
          id: string
          payload: Json
          response_code: number | null
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          event_type: Database["public"]["Enums"]["webhook_event_type"]
          id?: string
          payload?: Json
          response_code?: number | null
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          event_type?: Database["public"]["Enums"]["webhook_event_type"]
          id?: string
          payload?: Json
          response_code?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_professionals: {
        Row: {
          active: boolean | null
          avatar_url: string | null
          company_id: string | null
          id: string | null
          name: string | null
          slug: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collaborators_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      public_services: {
        Row: {
          company_id: string | null
          duration_minutes: number | null
          id: string | null
          name: string | null
          price: number | null
        }
        Insert: {
          company_id?: string | null
          duration_minutes?: number | null
          id?: string | null
          name?: string | null
          price?: number | null
        }
        Update: {
          company_id?: string | null
          duration_minutes?: number | null
          id?: string | null
          name?: string | null
          price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_appointment: {
        Args: {
          p_client_id?: string
          p_client_name?: string
          p_client_whatsapp?: string
          p_company_id: string
          p_end_time?: string
          p_notes?: string
          p_professional_id: string
          p_start_time?: string
          p_status?: string
          p_total_price?: number
        }
        Returns: string
      }
      create_appointment_services: {
        Args: { p_appointment_id: string; p_services: Json }
        Returns: undefined
      }
      create_client: {
        Args: {
          p_company_id: string
          p_cpf: string
          p_email: string
          p_name: string
          p_whatsapp: string
        }
        Returns: string
      }
      get_company_by_slug: {
        Args: { _slug: string }
        Returns: {
          business_type: Database["public"]["Enums"]["business_type"]
          id: string
          logo_url: string
          name: string
          phone: string
          slug: string
        }[]
      }
      get_my_company_id: { Args: never; Returns: string }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      has_company_role: {
        Args: {
          _company_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      lookup_client_by_cpf: {
        Args: { _company_id: string; _cpf: string }
        Returns: string
      }
      lookup_client_by_whatsapp: {
        Args: { _company_id: string; _whatsapp: string }
        Returns: string
      }
      recalculate_client_return_stats: {
        Args: { _company_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "super_admin" | "professional" | "collaborator" | "client"
      appointment_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "no_show"
      business_type: "barbershop" | "esthetic"
      collaborator_type: "partner" | "commissioned" | "independent"
      commission_type: "percentage" | "fixed" | "none"
      subscription_status: "active" | "inactive" | "blocked" | "trial"
      waiting_list_status:
        | "waiting"
        | "notified"
        | "confirmed"
        | "expired"
        | "cancelled"
      webhook_event_type:
        | "appointment_created"
        | "appointment_cancelled"
        | "appointment_reminder"
        | "client_return_due"
        | "birthday_message"
        | "slot_available"
        | "appointment_reminder_24h"
        | "appointment_reminder_3h"
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
      app_role: ["super_admin", "professional", "collaborator", "client"],
      appointment_status: [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
        "no_show",
      ],
      business_type: ["barbershop", "esthetic"],
      collaborator_type: ["partner", "commissioned", "independent"],
      commission_type: ["percentage", "fixed", "none"],
      subscription_status: ["active", "inactive", "blocked", "trial"],
      waiting_list_status: [
        "waiting",
        "notified",
        "confirmed",
        "expired",
        "cancelled",
      ],
      webhook_event_type: [
        "appointment_created",
        "appointment_cancelled",
        "appointment_reminder",
        "client_return_due",
        "birthday_message",
        "slot_available",
        "appointment_reminder_24h",
        "appointment_reminder_3h",
      ],
    },
  },
} as const
