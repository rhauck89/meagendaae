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
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          client_id: string
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
          client_id: string
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
          client_id?: string
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
        ]
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
      collaborators: {
        Row: {
          active: boolean
          collaborator_type: Database["public"]["Enums"]["collaborator_type"]
          commission_percent: number | null
          company_id: string
          created_at: string
          id: string
          profile_id: string
        }
        Insert: {
          active?: boolean
          collaborator_type: Database["public"]["Enums"]["collaborator_type"]
          commission_percent?: number | null
          company_id: string
          created_at?: string
          id?: string
          profile_id: string
        }
        Update: {
          active?: boolean
          collaborator_type?: Database["public"]["Enums"]["collaborator_type"]
          commission_percent?: number | null
          company_id?: string
          created_at?: string
          id?: string
          profile_id?: string
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
        ]
      }
      companies: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          owner_id: string | null
          phone: string | null
          slug: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          owner_id?: string | null
          phone?: string | null
          slug: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          phone?: string | null
          slug?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          birth_date: string | null
          company_id: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
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
          id: string
          professional_id: string
          service_id: string
        }
        Insert: {
          id?: string
          professional_id: string
          service_id: string
        }
        Update: {
          id?: string
          professional_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_professionals_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      [_ in never]: never
    }
    Functions: {
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
    }
    Enums: {
      app_role: "super_admin" | "professional" | "collaborator" | "client"
      appointment_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "no_show"
      collaborator_type: "partner" | "commissioned"
      subscription_status: "active" | "inactive" | "blocked" | "trial"
      webhook_event_type:
        | "appointment_created"
        | "appointment_cancelled"
        | "appointment_reminder"
        | "client_return_due"
        | "birthday_message"
        | "slot_available"
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
      collaborator_type: ["partner", "commissioned"],
      subscription_status: ["active", "inactive", "blocked", "trial"],
      webhook_event_type: [
        "appointment_created",
        "appointment_cancelled",
        "appointment_reminder",
        "client_return_due",
        "birthday_message",
        "slot_available",
      ],
    },
  },
} as const
