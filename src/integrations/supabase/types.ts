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
      amenities: {
        Row: {
          created_at: string
          icon: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          icon: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      appointment_requests: {
        Row: {
          client_email: string | null
          client_name: string
          client_whatsapp: string
          company_id: string
          created_at: string
          id: string
          message: string | null
          professional_id: string | null
          rejection_reason: string | null
          requested_date: string
          requested_time: string
          service_id: string | null
          status: string
          suggested_date: string | null
          suggested_time: string | null
          updated_at: string
        }
        Insert: {
          client_email?: string | null
          client_name: string
          client_whatsapp: string
          company_id: string
          created_at?: string
          id?: string
          message?: string | null
          professional_id?: string | null
          rejection_reason?: string | null
          requested_date: string
          requested_time: string
          service_id?: string | null
          status?: string
          suggested_date?: string | null
          suggested_time?: string | null
          updated_at?: string
        }
        Update: {
          client_email?: string | null
          client_name?: string
          client_whatsapp?: string
          company_id?: string
          created_at?: string
          id?: string
          message?: string | null
          professional_id?: string | null
          rejection_reason?: string | null
          requested_date?: string
          requested_time?: string
          service_id?: string | null
          status?: string
          suggested_date?: string | null
          suggested_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "appointment_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_requests_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_requests_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "appointment_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
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
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["service_id"]
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
          booking_origin: string | null
          cashback_used: number | null
          client_id: string | null
          client_name: string | null
          client_whatsapp: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          delay_applied_at: string | null
          delay_minutes: number | null
          delay_source_appointment_id: string | null
          end_time: string
          event_id: string | null
          extra_fee: number | null
          extra_fee_type: string | null
          extra_fee_value: number | null
          final_price: number | null
          id: string
          manual_discount: number | null
          notes: string | null
          original_price: number | null
          professional_id: string
          promotion_discount: number | null
          promotion_id: string | null
          rescheduled_from_id: string | null
          special_schedule: boolean | null
          start_time: string
          status: Database["public"]["Enums"]["appointment_status"]
          total_price: number
          updated_at: string
          user_id: string | null
          whatsapp_confirmation_sent: boolean | null
          whatsapp_reminder_1d_sent: boolean | null
          whatsapp_reminder_sent: boolean | null
          whatsapp_review_sent: boolean | null
        }
        Insert: {
          booking_origin?: string | null
          cashback_used?: number | null
          client_id?: string | null
          client_name?: string | null
          client_whatsapp?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          delay_applied_at?: string | null
          delay_minutes?: number | null
          delay_source_appointment_id?: string | null
          end_time: string
          event_id?: string | null
          extra_fee?: number | null
          extra_fee_type?: string | null
          extra_fee_value?: number | null
          final_price?: number | null
          id?: string
          manual_discount?: number | null
          notes?: string | null
          original_price?: number | null
          professional_id: string
          promotion_discount?: number | null
          promotion_id?: string | null
          rescheduled_from_id?: string | null
          special_schedule?: boolean | null
          start_time: string
          status?: Database["public"]["Enums"]["appointment_status"]
          total_price?: number
          updated_at?: string
          user_id?: string | null
          whatsapp_confirmation_sent?: boolean | null
          whatsapp_reminder_1d_sent?: boolean | null
          whatsapp_reminder_sent?: boolean | null
          whatsapp_review_sent?: boolean | null
        }
        Update: {
          booking_origin?: string | null
          cashback_used?: number | null
          client_id?: string | null
          client_name?: string | null
          client_whatsapp?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          delay_applied_at?: string | null
          delay_minutes?: number | null
          delay_source_appointment_id?: string | null
          end_time?: string
          event_id?: string | null
          extra_fee?: number | null
          extra_fee_type?: string | null
          extra_fee_value?: number | null
          final_price?: number | null
          id?: string
          manual_discount?: number | null
          notes?: string | null
          original_price?: number | null
          professional_id?: string
          promotion_discount?: number | null
          promotion_id?: string | null
          rescheduled_from_id?: string | null
          special_schedule?: boolean | null
          start_time?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          total_price?: number
          updated_at?: string
          user_id?: string | null
          whatsapp_confirmation_sent?: boolean | null
          whatsapp_reminder_1d_sent?: boolean | null
          whatsapp_reminder_sent?: boolean | null
          whatsapp_review_sent?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
            foreignKeyName: "appointments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "appointments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
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
          {
            foreignKeyName: "appointments_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "public_promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_rescheduled_from_id_fkey"
            columns: ["rescheduled_from_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments_swap_logs: {
        Row: {
          appointment_a_id: string
          appointment_b_id: string
          client_a_name: string | null
          client_b_name: string | null
          company_id: string
          created_at: string
          id: string
          new_end_a: string
          new_end_b: string
          new_professional_a: string
          new_professional_b: string
          new_start_a: string
          new_start_b: string
          old_end_a: string
          old_end_b: string
          old_professional_a: string
          old_professional_b: string
          old_start_a: string
          old_start_b: string
          reason: string | null
          swapped_by: string
        }
        Insert: {
          appointment_a_id: string
          appointment_b_id: string
          client_a_name?: string | null
          client_b_name?: string | null
          company_id: string
          created_at?: string
          id?: string
          new_end_a: string
          new_end_b: string
          new_professional_a: string
          new_professional_b: string
          new_start_a: string
          new_start_b: string
          old_end_a: string
          old_end_b: string
          old_professional_a: string
          old_professional_b: string
          old_start_a: string
          old_start_b: string
          reason?: string | null
          swapped_by: string
        }
        Update: {
          appointment_a_id?: string
          appointment_b_id?: string
          client_a_name?: string | null
          client_b_name?: string | null
          company_id?: string
          created_at?: string
          id?: string
          new_end_a?: string
          new_end_b?: string
          new_professional_a?: string
          new_professional_b?: string
          new_start_a?: string
          new_start_b?: string
          old_end_a?: string
          old_end_b?: string
          old_professional_a?: string
          old_professional_b?: string
          old_start_a?: string
          old_start_b?: string
          reason?: string | null
          swapped_by?: string
        }
        Relationships: []
      }
      auth_otps: {
        Row: {
          attempts: number | null
          code: string
          company_id: string | null
          created_at: string | null
          email: string | null
          expires_at: string
          id: string
          ip_address: string | null
          last_sent_at: string | null
          max_attempts: number | null
          metadata: Json | null
          phone: string | null
          used: boolean | null
        }
        Insert: {
          attempts?: number | null
          code: string
          company_id?: string | null
          created_at?: string | null
          email?: string | null
          expires_at: string
          id?: string
          ip_address?: string | null
          last_sent_at?: string | null
          max_attempts?: number | null
          metadata?: Json | null
          phone?: string | null
          used?: boolean | null
        }
        Update: {
          attempts?: number | null
          code?: string
          company_id?: string | null
          created_at?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          last_sent_at?: string | null
          max_attempts?: number | null
          metadata?: Json | null
          phone?: string | null
          used?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_otps_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_otps_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_otps_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "auth_otps_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_otps_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
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
      booking_abandonments: {
        Row: {
          client_id: string | null
          company_id: string | null
          converted_at: string | null
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          last_sent_at: string | null
          metadata: Json | null
          professional_id: string | null
          service_ids: string[] | null
          session_id: string | null
          start_time: string | null
          status: string | null
        }
        Insert: {
          client_id?: string | null
          company_id?: string | null
          converted_at?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          last_sent_at?: string | null
          metadata?: Json | null
          professional_id?: string | null
          service_ids?: string[] | null
          session_id?: string | null
          start_time?: string | null
          status?: string | null
        }
        Update: {
          client_id?: string | null
          company_id?: string | null
          converted_at?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          last_sent_at?: string | null
          metadata?: Json | null
          professional_id?: string | null
          service_ids?: string[] | null
          session_id?: string | null
          start_time?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_abandonments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_abandonments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_abandonments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_abandonments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "booking_abandonments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_abandonments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_metrics: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          metric_type: string
          value: number | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          metric_type: string
          value?: number | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          metric_type?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "booking_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
        ]
      }
      brazilian_cities: {
        Row: {
          id: number
          name: string
          state_id: number
        }
        Insert: {
          id?: number
          name: string
          state_id: number
        }
        Update: {
          id?: number
          name?: string
          state_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "brazilian_cities_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "brazilian_states"
            referencedColumns: ["id"]
          },
        ]
      }
      brazilian_states: {
        Row: {
          id: number
          name: string
          uf: string
        }
        Insert: {
          id?: number
          name: string
          uf: string
        }
        Update: {
          id?: number
          name?: string
          uf?: string
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
          {
            foreignKeyName: "business_exceptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_exceptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "business_exceptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_exceptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
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
          {
            foreignKeyName: "business_hours_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_hours_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "business_hours_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_hours_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
        ]
      }
      cashback_transactions: {
        Row: {
          amount: number
          client_id: string
          company_id: string
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          amount: number
          client_id: string
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          client_id?: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cashback_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashback_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashback_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashback_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "cashback_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashback_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
          type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          type?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          type?: string
        }
        Relationships: []
      }
      cities: {
        Row: {
          created_at: string | null
          id: string
          name: string
          state_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          state_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          state_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cities_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      client_cashback: {
        Row: {
          amount: number
          appointment_id: string | null
          client_id: string
          company_id: string
          created_at: string
          expires_at: string
          id: string
          promotion_id: string
          status: string
          used_appointment_id: string | null
          used_at: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number
          appointment_id?: string | null
          client_id: string
          company_id: string
          created_at?: string
          expires_at: string
          id?: string
          promotion_id: string
          status?: string
          used_appointment_id?: string | null
          used_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          client_id?: string
          company_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          promotion_id?: string
          status?: string
          used_appointment_id?: string | null
          used_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_cashback_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_cashback_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_cashback_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_cashback_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_cashback_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "client_cashback_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_cashback_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_cashback_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_cashback_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "public_promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_cashback_used_appointment_id_fkey"
            columns: ["used_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      client_companies: {
        Row: {
          client_global_id: string | null
          company_id: string | null
          created_at: string | null
          id: string
        }
        Insert: {
          client_global_id?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
        }
        Update: {
          client_global_id?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_companies_client_global_id_fkey"
            columns: ["client_global_id"]
            isOneToOne: false
            referencedRelation: "clients_global"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "client_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address_number: string | null
          birth_date: string | null
          city: string | null
          company_id: string
          cpf: string | null
          created_at: string
          district: string | null
          email: string | null
          global_client_id: string | null
          id: string
          is_blocked: boolean
          name: string
          next_recommended_visit: string | null
          opt_in_whatsapp: boolean
          postal_code: string | null
          registration_complete: boolean
          state: string | null
          street: string | null
          updated_at: string | null
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          address_number?: string | null
          birth_date?: string | null
          city?: string | null
          company_id: string
          cpf?: string | null
          created_at?: string
          district?: string | null
          email?: string | null
          global_client_id?: string | null
          id?: string
          is_blocked?: boolean
          name: string
          next_recommended_visit?: string | null
          opt_in_whatsapp?: boolean
          postal_code?: string | null
          registration_complete?: boolean
          state?: string | null
          street?: string | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          address_number?: string | null
          birth_date?: string | null
          city?: string | null
          company_id?: string
          cpf?: string | null
          created_at?: string
          district?: string | null
          email?: string | null
          global_client_id?: string | null
          id?: string
          is_blocked?: boolean
          name?: string
          next_recommended_visit?: string | null
          opt_in_whatsapp?: boolean
          postal_code?: string | null
          registration_complete?: boolean
          state?: string | null
          street?: string | null
          updated_at?: string | null
          user_id?: string | null
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
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_global_client_id_fkey"
            columns: ["global_client_id"]
            isOneToOne: false
            referencedRelation: "clients_global"
            referencedColumns: ["id"]
          },
        ]
      }
      clients_global: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string | null
          updated_at: string | null
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      collaborators: {
        Row: {
          absence_end: string | null
          absence_start: string | null
          absence_type: string | null
          active: boolean
          booking_mode: string
          break_time: number
          business_model: string | null
          collaborator_type: Database["public"]["Enums"]["collaborator_type"]
          commission_percent: number | null
          commission_type: Database["public"]["Enums"]["commission_type"]
          commission_value: number
          company_id: string
          created_at: string
          grid_interval: number
          has_system_access: boolean
          id: string
          partner_equity_percent: number
          partner_revenue_mode: string | null
          profile_id: string
          rent_amount: number
          rent_cycle: string | null
          slug: string | null
          system_role: string | null
          use_company_banner: boolean
        }
        Insert: {
          absence_end?: string | null
          absence_start?: string | null
          absence_type?: string | null
          active?: boolean
          booking_mode?: string
          break_time?: number
          business_model?: string | null
          collaborator_type: Database["public"]["Enums"]["collaborator_type"]
          commission_percent?: number | null
          commission_type?: Database["public"]["Enums"]["commission_type"]
          commission_value?: number
          company_id: string
          created_at?: string
          grid_interval?: number
          has_system_access?: boolean
          id?: string
          partner_equity_percent?: number
          partner_revenue_mode?: string | null
          profile_id: string
          rent_amount?: number
          rent_cycle?: string | null
          slug?: string | null
          system_role?: string | null
          use_company_banner?: boolean
        }
        Update: {
          absence_end?: string | null
          absence_start?: string | null
          absence_type?: string | null
          active?: boolean
          booking_mode?: string
          break_time?: number
          business_model?: string | null
          collaborator_type?: Database["public"]["Enums"]["collaborator_type"]
          commission_percent?: number | null
          commission_type?: Database["public"]["Enums"]["commission_type"]
          commission_value?: number
          company_id?: string
          created_at?: string
          grid_interval?: number
          has_system_access?: boolean
          id?: string
          partner_equity_percent?: number
          partner_revenue_mode?: string | null
          profile_id?: string
          rent_amount?: number
          rent_cycle?: string | null
          slug?: string | null
          system_role?: string | null
          use_company_banner?: boolean
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
            foreignKeyName: "collaborators_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborators_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "collaborators_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborators_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
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
          activated_at: string | null
          activation_score: number
          address: string | null
          address_number: string | null
          allow_custom_requests: boolean
          billing_cycle: string
          birthday_discount_type: string
          birthday_discount_value: number
          birthday_enabled: boolean
          booking_mode: string
          buffer_minutes: number
          business_type: Database["public"]["Enums"]["business_type"]
          cancel_at_period_end: boolean
          city: string | null
          cover_url: string | null
          created_at: string
          current_period_end: string | null
          description: string | null
          district: string | null
          facebook: string | null
          fixed_slot_interval: number
          google_maps_url: string | null
          google_review_url: string | null
          grace_period_until: string | null
          id: string
          instagram: string | null
          is_active: boolean | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          marketplace_active: boolean
          name: string
          paddle_customer_id: string | null
          paddle_subscription_id: string | null
          pending_billing_cycle: string | null
          pending_change_at: string | null
          pending_plan_id: string | null
          phone: string | null
          plan_id: string | null
          postal_code: string | null
          prof_perm_booking_mode: boolean
          prof_perm_clients: boolean
          prof_perm_events: boolean
          prof_perm_finance: boolean
          prof_perm_grid_interval: boolean
          prof_perm_promotions: boolean
          prof_perm_requests: boolean
          reminders_enabled: boolean
          slug: string
          state: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          timezone: string
          trial_active: boolean
          trial_end_date: string | null
          trial_plan_id: string | null
          trial_start_date: string | null
          updated_at: string
          user_id: string | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          activated_at?: string | null
          activation_score?: number
          address?: string | null
          address_number?: string | null
          allow_custom_requests?: boolean
          billing_cycle?: string
          birthday_discount_type?: string
          birthday_discount_value?: number
          birthday_enabled?: boolean
          booking_mode?: string
          buffer_minutes?: number
          business_type?: Database["public"]["Enums"]["business_type"]
          cancel_at_period_end?: boolean
          city?: string | null
          cover_url?: string | null
          created_at?: string
          current_period_end?: string | null
          description?: string | null
          district?: string | null
          facebook?: string | null
          fixed_slot_interval?: number
          google_maps_url?: string | null
          google_review_url?: string | null
          grace_period_until?: string | null
          id?: string
          instagram?: string | null
          is_active?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          marketplace_active?: boolean
          name: string
          paddle_customer_id?: string | null
          paddle_subscription_id?: string | null
          pending_billing_cycle?: string | null
          pending_change_at?: string | null
          pending_plan_id?: string | null
          phone?: string | null
          plan_id?: string | null
          postal_code?: string | null
          prof_perm_booking_mode?: boolean
          prof_perm_clients?: boolean
          prof_perm_events?: boolean
          prof_perm_finance?: boolean
          prof_perm_grid_interval?: boolean
          prof_perm_promotions?: boolean
          prof_perm_requests?: boolean
          reminders_enabled?: boolean
          slug: string
          state?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          timezone?: string
          trial_active?: boolean
          trial_end_date?: string | null
          trial_plan_id?: string | null
          trial_start_date?: string | null
          updated_at?: string
          user_id?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          activated_at?: string | null
          activation_score?: number
          address?: string | null
          address_number?: string | null
          allow_custom_requests?: boolean
          billing_cycle?: string
          birthday_discount_type?: string
          birthday_discount_value?: number
          birthday_enabled?: boolean
          booking_mode?: string
          buffer_minutes?: number
          business_type?: Database["public"]["Enums"]["business_type"]
          cancel_at_period_end?: boolean
          city?: string | null
          cover_url?: string | null
          created_at?: string
          current_period_end?: string | null
          description?: string | null
          district?: string | null
          facebook?: string | null
          fixed_slot_interval?: number
          google_maps_url?: string | null
          google_review_url?: string | null
          grace_period_until?: string | null
          id?: string
          instagram?: string | null
          is_active?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          marketplace_active?: boolean
          name?: string
          paddle_customer_id?: string | null
          paddle_subscription_id?: string | null
          pending_billing_cycle?: string | null
          pending_change_at?: string | null
          pending_plan_id?: string | null
          phone?: string | null
          plan_id?: string | null
          postal_code?: string | null
          prof_perm_booking_mode?: boolean
          prof_perm_clients?: boolean
          prof_perm_events?: boolean
          prof_perm_finance?: boolean
          prof_perm_grid_interval?: boolean
          prof_perm_promotions?: boolean
          prof_perm_requests?: boolean
          reminders_enabled?: boolean
          slug?: string
          state?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          timezone?: string
          trial_active?: boolean
          trial_end_date?: string | null
          trial_plan_id?: string | null
          trial_start_date?: string | null
          updated_at?: string
          user_id?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_pending_plan_id_fkey"
            columns: ["pending_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_trial_plan_id_fkey"
            columns: ["trial_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      company_amenities: {
        Row: {
          amenity_id: string
          company_id: string
          created_at: string
          id: string
          is_featured: boolean
        }
        Insert: {
          amenity_id: string
          company_id: string
          created_at?: string
          id?: string
          is_featured?: boolean
        }
        Update: {
          amenity_id?: string
          company_id?: string
          created_at?: string
          id?: string
          is_featured?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "company_amenities_amenity_id_fkey"
            columns: ["amenity_id"]
            isOneToOne: false
            referencedRelation: "amenities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_amenities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_amenities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_amenities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_amenities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_amenities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
        ]
      }
      company_billing: {
        Row: {
          company_id: string
          created_at: string
          id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_billing_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_billing_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_billing_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_billing_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_billing_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
        ]
      }
      company_categories: {
        Row: {
          category_id: string
          company_id: string
          created_at: string | null
          id: string
          subcategory_id: string
        }
        Insert: {
          category_id: string
          company_id: string
          created_at?: string | null
          id?: string
          subcategory_id: string
        }
        Update: {
          category_id?: string
          company_id?: string
          created_at?: string | null
          id?: string
          subcategory_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_categories_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      company_domains: {
        Row: {
          company_id: string
          created_at: string
          domain: string
          id: string
          ssl_status: string
          updated_at: string
          verified: boolean
        }
        Insert: {
          company_id: string
          created_at?: string
          domain: string
          id?: string
          ssl_status?: string
          updated_at?: string
          verified?: boolean
        }
        Update: {
          company_id?: string
          created_at?: string
          domain?: string
          id?: string
          ssl_status?: string
          updated_at?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "company_domains_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_domains_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_domains_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_domains_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_domains_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
        ]
      }
      company_expense_categories: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          type: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          type?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_expense_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_expense_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_expense_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_expense_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_expense_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
        ]
      }
      company_expenses: {
        Row: {
          amount: number
          category_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string
          due_date: string | null
          expense_date: string
          id: string
          installment_group_id: string | null
          installment_number: number | null
          is_recurring: boolean
          notes: string | null
          parent_expense_id: string | null
          payment_method: string | null
          recurrence_interval: number | null
          recurrence_type: string | null
          status: string
          total_installments: number | null
          updated_at: string
        }
        Insert: {
          amount?: number
          category_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description: string
          due_date?: string | null
          expense_date?: string
          id?: string
          installment_group_id?: string | null
          installment_number?: number | null
          is_recurring?: boolean
          notes?: string | null
          parent_expense_id?: string | null
          payment_method?: string | null
          recurrence_interval?: number | null
          recurrence_type?: string | null
          status?: string
          total_installments?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string | null
          expense_date?: string
          id?: string
          installment_group_id?: string | null
          installment_number?: number | null
          is_recurring?: boolean
          notes?: string | null
          parent_expense_id?: string | null
          payment_method?: string | null
          recurrence_interval?: number | null
          recurrence_type?: string | null
          status?: string
          total_installments?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "company_expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_expenses_parent_expense_id_fkey"
            columns: ["parent_expense_id"]
            isOneToOne: false
            referencedRelation: "company_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      company_gallery: {
        Row: {
          caption: string | null
          company_id: string
          created_at: string
          id: string
          image_url: string
          sort_order: number
        }
        Insert: {
          caption?: string | null
          company_id: string
          created_at?: string
          id?: string
          image_url: string
          sort_order?: number
        }
        Update: {
          caption?: string | null
          company_id?: string
          created_at?: string
          id?: string
          image_url?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_gallery_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_gallery_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_gallery_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_gallery_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_gallery_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
        ]
      }
      company_modules: {
        Row: {
          billing_cycle: string
          company_id: string
          created_at: string
          ends_at: string | null
          id: string
          module_id: string
          started_at: string
          status: string
          stripe_subscription_item_id: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          company_id: string
          created_at?: string
          ends_at?: string | null
          id?: string
          module_id: string
          started_at?: string
          status?: string
          stripe_subscription_item_id?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          company_id?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          module_id?: string
          started_at?: string
          status?: string
          stripe_subscription_item_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "plan_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      company_revenue_categories: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_revenue_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_revenue_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_revenue_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_revenue_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_revenue_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
        ]
      }
      company_revenues: {
        Row: {
          amount: number
          appointment_id: string | null
          category_id: string | null
          client_name: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string
          due_date: string | null
          id: string
          is_automatic: boolean
          notes: string | null
          payment_method: string | null
          professional_id: string | null
          professional_name: string | null
          revenue_date: string
          service_id: string | null
          service_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          appointment_id?: string | null
          category_id?: string | null
          client_name?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description: string
          due_date?: string | null
          id?: string
          is_automatic?: boolean
          notes?: string | null
          payment_method?: string | null
          professional_id?: string | null
          professional_name?: string | null
          revenue_date?: string
          service_id?: string | null
          service_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          category_id?: string | null
          client_name?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string | null
          id?: string
          is_automatic?: boolean
          notes?: string | null
          payment_method?: string | null
          professional_id?: string | null
          professional_name?: string | null
          revenue_date?: string
          service_id?: string | null
          service_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_revenues_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_revenues_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "company_revenue_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_revenues_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_revenues_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_revenues_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_revenues_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_revenues_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_revenues_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_revenues_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_revenues_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "company_revenues_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_revenues_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          background_color: string
          booking_buffer_minutes: number
          company_id: string
          created_at: string
          id: string
          logo_url: string | null
          primary_color: string
          secondary_color: string
          theme_style: string | null
          timezone: string
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          background_color?: string
          booking_buffer_minutes?: number
          company_id: string
          created_at?: string
          id?: string
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string
          theme_style?: string | null
          timezone?: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          background_color?: string
          booking_buffer_minutes?: number
          company_id?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string
          theme_style?: string | null
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
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          company_id: string | null
          created_at: string | null
          email_type: string
          error_message: string | null
          from_email: string
          id: string
          resend_id: string | null
          status: string
          subject: string
          ticket_id: string | null
          to_email: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          email_type: string
          error_message?: string | null
          from_email: string
          id?: string
          resend_id?: string | null
          status: string
          subject: string
          ticket_id?: string | null
          to_email: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          email_type?: string
          error_message?: string | null
          from_email?: string
          id?: string
          resend_id?: string | null
          status?: string
          subject?: string
          ticket_id?: string | null
          to_email?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "email_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
        ]
      }
      event_service_prices: {
        Row: {
          event_id: string
          id: string
          override_price: number
          service_id: string
        }
        Insert: {
          event_id: string
          id?: string
          override_price: number
          service_id: string
        }
        Update: {
          event_id?: string
          id?: string
          override_price?: number
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_service_prices_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_service_prices_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "event_service_prices_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_service_prices_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      event_services: {
        Row: {
          created_at: string
          event_id: string
          event_price: number | null
          id: string
          service_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          event_price?: number | null
          id?: string
          service_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          event_price?: number | null
          id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_services_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "event_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      event_slots: {
        Row: {
          created_at: string
          current_bookings: number
          end_time: string
          event_id: string
          id: string
          max_bookings: number
          professional_id: string
          slot_date: string
          start_time: string
        }
        Insert: {
          created_at?: string
          current_bookings?: number
          end_time: string
          event_id: string
          id?: string
          max_bookings?: number
          professional_id: string
          slot_date: string
          start_time: string
        }
        Update: {
          created_at?: string
          current_bookings?: number
          end_time?: string
          event_id?: string
          id?: string
          max_bookings?: number
          professional_id?: string
          slot_date?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_slots_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_slots_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_slots_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          block_main_schedule: boolean | null
          company_id: string
          cover_image: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string
          id: string
          image_position_x: number
          image_position_y: number
          image_zoom: number
          max_bookings_per_client: number
          name: string
          slug: string
          start_date: string
          status: Database["public"]["Enums"]["event_status"]
          updated_at: string
        }
        Insert: {
          block_main_schedule?: boolean | null
          company_id: string
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date: string
          id?: string
          image_position_x?: number
          image_position_y?: number
          image_zoom?: number
          max_bookings_per_client?: number
          name: string
          slug: string
          start_date: string
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
        }
        Update: {
          block_main_schedule?: boolean | null
          company_id?: string
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string
          id?: string
          image_position_x?: number
          image_position_y?: number
          image_zoom?: number
          max_bookings_per_client?: number
          name?: string
          slug?: string
          start_date?: string
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          type?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          type?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          description: string
          expense_date: string
          id: string
          is_recurring: boolean
          notes: string | null
          parent_recurring_id: string | null
          recurrence_count: number | null
          recurrence_end_date: string | null
          recurrence_interval: number | null
          recurrence_type: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          category_id?: string | null
          created_at?: string
          description: string
          expense_date?: string
          id?: string
          is_recurring?: boolean
          notes?: string | null
          parent_recurring_id?: string | null
          recurrence_count?: number | null
          recurrence_end_date?: string | null
          recurrence_interval?: number | null
          recurrence_type?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          description?: string
          expense_date?: string
          id?: string
          is_recurring?: boolean
          notes?: string | null
          parent_recurring_id?: string | null
          recurrence_count?: number | null
          recurrence_end_date?: string | null
          recurrence_interval?: number | null
          recurrence_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_parent_recurring_id_fkey"
            columns: ["parent_recurring_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_discovery: {
        Row: {
          feature_key: string
          id: string
          seen_at: string
          user_id: string
        }
        Insert: {
          feature_key: string
          id?: string
          seen_at?: string
          user_id: string
        }
        Update: {
          feature_key?: string
          id?: string
          seen_at?: string
          user_id?: string
        }
        Relationships: []
      }
      loyalty_config: {
        Row: {
          company_id: string
          created_at: string
          enabled: boolean
          id: string
          participating_professionals: string
          participating_services: string
          point_value: number
          points_per_currency: number
          points_per_service: number
          scoring_type: string
          specific_professional_ids: string[]
          specific_service_ids: string[]
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          participating_professionals?: string
          participating_services?: string
          point_value?: number
          points_per_currency?: number
          points_per_service?: number
          scoring_type?: string
          specific_professional_ids?: string[]
          specific_service_ids?: string[]
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          participating_professionals?: string
          participating_services?: string
          point_value?: number
          points_per_currency?: number
          points_per_service?: number
          scoring_type?: string
          specific_professional_ids?: string[]
          specific_service_ids?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "loyalty_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_points_transactions: {
        Row: {
          balance_after: number
          client_id: string
          company_id: string
          created_at: string
          description: string | null
          id: string
          points: number
          reference_id: string | null
          reference_type: string | null
          transaction_type: string
          user_id: string | null
        }
        Insert: {
          balance_after?: number
          client_id: string
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          points: number
          reference_id?: string | null
          reference_type?: string | null
          transaction_type: string
          user_id?: string | null
        }
        Update: {
          balance_after?: number
          client_id?: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          points?: number
          reference_id?: string | null
          reference_type?: string | null
          transaction_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_points_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_points_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_points_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_points_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "loyalty_points_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_points_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_redemptions: {
        Row: {
          client_id: string
          company_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          id: string
          items: Json
          redemption_code: string
          reward_id: string | null
          status: string
          total_points: number
          user_id: string | null
        }
        Insert: {
          client_id: string
          company_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          items?: Json
          redemption_code: string
          reward_id?: string | null
          status?: string
          total_points: number
          user_id?: string | null
        }
        Update: {
          client_id?: string
          company_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          items?: Json
          redemption_code?: string
          reward_id?: string | null
          status?: string
          total_points?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_redemptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_redemptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_redemptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_redemptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "loyalty_redemptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_redemptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "loyalty_reward_items"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_reward_items: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          description: string | null
          extra_cost: number
          id: string
          image_url: string | null
          item_type: string
          name: string
          points_required: number
          real_value: number
          stock_available: number | null
          stock_reserved: number
          stock_total: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          description?: string | null
          extra_cost?: number
          id?: string
          image_url?: string | null
          item_type?: string
          name: string
          points_required?: number
          real_value?: number
          stock_available?: number | null
          stock_reserved?: number
          stock_total?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          description?: string | null
          extra_cost?: number
          id?: string
          image_url?: string | null
          item_type?: string
          name?: string
          points_required?: number
          real_value?: number
          stock_available?: number | null
          stock_reserved?: number
          stock_total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_reward_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_reward_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_reward_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "loyalty_reward_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_reward_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_revenues: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          is_recurring: boolean
          notes: string | null
          parent_recurring_id: string | null
          recurrence_count: number | null
          recurrence_end_date: string | null
          recurrence_interval: number | null
          recurrence_type: string | null
          revenue_date: string
          source: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          id?: string
          is_recurring?: boolean
          notes?: string | null
          parent_recurring_id?: string | null
          recurrence_count?: number | null
          recurrence_end_date?: string | null
          recurrence_interval?: number | null
          recurrence_type?: string | null
          revenue_date?: string
          source?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          is_recurring?: boolean
          notes?: string | null
          parent_recurring_id?: string | null
          recurrence_count?: number | null
          recurrence_end_date?: string | null
          recurrence_interval?: number | null
          recurrence_type?: string | null
          revenue_date?: string
          source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_revenues_parent_recurring_id_fkey"
            columns: ["parent_recurring_id"]
            isOneToOne: false
            referencedRelation: "manual_revenues"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_banner_events: {
        Row: {
          banner_id: string | null
          created_at: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          banner_id?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          banner_id?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_banner_events_banner_id_fkey"
            columns: ["banner_id"]
            isOneToOne: false
            referencedRelation: "marketplace_banners"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_banners: {
        Row: {
          category: string | null
          city: string | null
          city_id: string | null
          client_name: string | null
          company_id: string | null
          country: string | null
          created_at: string | null
          current_clicks: number | null
          current_impressions: number | null
          deleted_at: string | null
          desktop_image_url: string
          destination_link: string | null
          end_date: string
          id: string
          internal_notes: string | null
          latitude: number | null
          limit_clicks: number | null
          limit_impressions: number | null
          longitude: number | null
          mobile_image_url: string | null
          name: string
          neighborhood: string | null
          open_in_new_tab: boolean | null
          position: string
          priority: number | null
          radius_km: number | null
          rotation_weight: number | null
          sale_model: string
          start_date: string
          state: string | null
          state_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          city?: string | null
          city_id?: string | null
          client_name?: string | null
          company_id?: string | null
          country?: string | null
          created_at?: string | null
          current_clicks?: number | null
          current_impressions?: number | null
          deleted_at?: string | null
          desktop_image_url: string
          destination_link?: string | null
          end_date: string
          id?: string
          internal_notes?: string | null
          latitude?: number | null
          limit_clicks?: number | null
          limit_impressions?: number | null
          longitude?: number | null
          mobile_image_url?: string | null
          name: string
          neighborhood?: string | null
          open_in_new_tab?: boolean | null
          position: string
          priority?: number | null
          radius_km?: number | null
          rotation_weight?: number | null
          sale_model?: string
          start_date: string
          state?: string | null
          state_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          city?: string | null
          city_id?: string | null
          client_name?: string | null
          company_id?: string | null
          country?: string | null
          created_at?: string | null
          current_clicks?: number | null
          current_impressions?: number | null
          deleted_at?: string | null
          desktop_image_url?: string
          destination_link?: string | null
          end_date?: string
          id?: string
          internal_notes?: string | null
          latitude?: number | null
          limit_clicks?: number | null
          limit_impressions?: number | null
          longitude?: number | null
          mobile_image_url?: string | null
          name?: string
          neighborhood?: string | null
          open_in_new_tab?: boolean | null
          position?: string
          priority?: number | null
          radius_km?: number | null
          rotation_weight?: number | null
          sale_model?: string
          start_date?: string
          state?: string | null
          state_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_banners_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_banners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_banners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_banners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "marketplace_banners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_banners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_banners_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_featured_items: {
        Row: {
          category: string | null
          city: string | null
          city_id: string | null
          company_id: string | null
          country: string | null
          created_at: string | null
          end_at: string | null
          end_date: string
          highlight_type: string | null
          id: string
          internal_notes: string | null
          item_type: string
          latitude: number | null
          longitude: number | null
          neighborhood: string | null
          position: string
          priority: number | null
          professional_id: string | null
          radius_km: number | null
          rotation_weight: number | null
          start_at: string | null
          start_date: string
          state: string | null
          state_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          city?: string | null
          city_id?: string | null
          company_id?: string | null
          country?: string | null
          created_at?: string | null
          end_at?: string | null
          end_date: string
          highlight_type?: string | null
          id?: string
          internal_notes?: string | null
          item_type: string
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string | null
          position: string
          priority?: number | null
          professional_id?: string | null
          radius_km?: number | null
          rotation_weight?: number | null
          start_at?: string | null
          start_date: string
          state?: string | null
          state_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          city?: string | null
          city_id?: string | null
          company_id?: string | null
          country?: string | null
          created_at?: string | null
          end_at?: string | null
          end_date?: string
          highlight_type?: string | null
          id?: string
          internal_notes?: string | null
          item_type?: string
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string | null
          position?: string
          priority?: number | null
          professional_id?: string | null
          radius_km?: number | null
          rotation_weight?: number | null
          start_at?: string | null
          start_date?: string
          state?: string | null
          state_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_featured_items_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_featured_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_featured_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_featured_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "marketplace_featured_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_featured_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_featured_items_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_featured_items_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_featured_items_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_home_settings: {
        Row: {
          benefit_1_description: string | null
          benefit_1_title: string | null
          benefit_2_description: string | null
          benefit_2_title: string | null
          benefit_3_description: string | null
          benefit_3_title: string | null
          cta_professional_button_text: string | null
          cta_professional_image_url: string | null
          cta_professional_subtitle: string | null
          cta_professional_title: string | null
          hero_badge: string | null
          hero_image_url: string | null
          hero_subtitle: string | null
          hero_title: string | null
          id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          benefit_1_description?: string | null
          benefit_1_title?: string | null
          benefit_2_description?: string | null
          benefit_2_title?: string | null
          benefit_3_description?: string | null
          benefit_3_title?: string | null
          cta_professional_button_text?: string | null
          cta_professional_image_url?: string | null
          cta_professional_subtitle?: string | null
          cta_professional_title?: string | null
          hero_badge?: string | null
          hero_image_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          benefit_1_description?: string | null
          benefit_1_title?: string | null
          benefit_2_description?: string | null
          benefit_2_title?: string | null
          benefit_3_description?: string | null
          benefit_3_title?: string | null
          cta_professional_button_text?: string | null
          cta_professional_image_url?: string | null
          cta_professional_subtitle?: string | null
          cta_professional_title?: string | null
          hero_badge?: string | null
          hero_image_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      migration_audit_log: {
        Row: {
          action: string
          confidence_level: string | null
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          match_type: string | null
          message: string | null
          status: string
        }
        Insert: {
          action: string
          confidence_level?: string | null
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          match_type?: string | null
          message?: string | null
          status: string
        }
        Update: {
          action?: string
          confidence_level?: string | null
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          match_type?: string | null
          message?: string | null
          status?: string
        }
        Relationships: []
      }
      pending_super_admins: {
        Row: {
          created_at: string | null
          email: string
        }
        Insert: {
          created_at?: string | null
          email: string
        }
        Update: {
          created_at?: string | null
          email?: string
        }
        Relationships: []
      }
      plan_modules: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          price_monthly: number
          price_yearly: number
          slug: string
          sort_order: number
          stripe_monthly_price_id: string | null
          stripe_product_id: string | null
          stripe_yearly_price_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          price_monthly?: number
          price_yearly?: number
          slug: string
          sort_order?: number
          stripe_monthly_price_id?: string | null
          stripe_product_id?: string | null
          stripe_yearly_price_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          price_monthly?: number
          price_yearly?: number
          slug?: string
          sort_order?: number
          stripe_monthly_price_id?: string | null
          stripe_product_id?: string | null
          stripe_yearly_price_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          active: boolean
          advanced_reports: boolean
          automatic_messages: boolean
          automation: boolean
          badge: string | null
          cashback: boolean
          created_at: string
          custom_branding: boolean
          custom_colors: boolean
          custom_domain: boolean
          discount_coupons: boolean
          feature_financial_level: string
          feature_requests: boolean
          id: string
          loyalty: boolean
          marketplace_priority: number
          members_limit: number
          monthly_price: number
          monthly_reports: boolean
          multi_location_ready: boolean
          name: string
          open_agenda: boolean
          open_scheduling: boolean
          paddle_monthly_price_id: string | null
          paddle_product_id: string | null
          paddle_yearly_price_id: string | null
          premium_templates: boolean
          promotions: boolean
          slug: string | null
          sort_order: number
          stripe_monthly_price_id: string | null
          stripe_product_id: string | null
          stripe_yearly_price_id: string | null
          support_priority: boolean
          updated_at: string
          whatsapp_default: boolean
          whitelabel: boolean
          yearly_discount: number
          yearly_price: number
        }
        Insert: {
          active?: boolean
          advanced_reports?: boolean
          automatic_messages?: boolean
          automation?: boolean
          badge?: string | null
          cashback?: boolean
          created_at?: string
          custom_branding?: boolean
          custom_colors?: boolean
          custom_domain?: boolean
          discount_coupons?: boolean
          feature_financial_level?: string
          feature_requests?: boolean
          id?: string
          loyalty?: boolean
          marketplace_priority?: number
          members_limit?: number
          monthly_price?: number
          monthly_reports?: boolean
          multi_location_ready?: boolean
          name: string
          open_agenda?: boolean
          open_scheduling?: boolean
          paddle_monthly_price_id?: string | null
          paddle_product_id?: string | null
          paddle_yearly_price_id?: string | null
          premium_templates?: boolean
          promotions?: boolean
          slug?: string | null
          sort_order?: number
          stripe_monthly_price_id?: string | null
          stripe_product_id?: string | null
          stripe_yearly_price_id?: string | null
          support_priority?: boolean
          updated_at?: string
          whatsapp_default?: boolean
          whitelabel?: boolean
          yearly_discount?: number
          yearly_price?: number
        }
        Update: {
          active?: boolean
          advanced_reports?: boolean
          automatic_messages?: boolean
          automation?: boolean
          badge?: string | null
          cashback?: boolean
          created_at?: string
          custom_branding?: boolean
          custom_colors?: boolean
          custom_domain?: boolean
          discount_coupons?: boolean
          feature_financial_level?: string
          feature_requests?: boolean
          id?: string
          loyalty?: boolean
          marketplace_priority?: number
          members_limit?: number
          monthly_price?: number
          monthly_reports?: boolean
          multi_location_ready?: boolean
          name?: string
          open_agenda?: boolean
          open_scheduling?: boolean
          paddle_monthly_price_id?: string | null
          paddle_product_id?: string | null
          paddle_yearly_price_id?: string | null
          premium_templates?: boolean
          promotions?: boolean
          slug?: string | null
          sort_order?: number
          stripe_monthly_price_id?: string | null
          stripe_product_id?: string | null
          stripe_yearly_price_id?: string | null
          support_priority?: boolean
          updated_at?: string
          whatsapp_default?: boolean
          whitelabel?: boolean
          yearly_discount?: number
          yearly_price?: number
        }
        Relationships: []
      }
      platform_messages: {
        Row: {
          active: boolean
          content: string
          created_at: string
          created_by: string | null
          id: string
          send_dashboard_notification: boolean
          send_whatsapp: boolean
          target_business_type: string | null
          target_plan: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          send_dashboard_notification?: boolean
          send_whatsapp?: boolean
          target_business_type?: string | null
          target_plan?: string | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          send_dashboard_notification?: boolean
          send_whatsapp?: boolean
          target_business_type?: string | null
          target_plan?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_messages_target_plan_fkey"
            columns: ["target_plan"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          created_at: string
          default_keywords: string | null
          favicon_url: string | null
          id: string
          logo_dark: string | null
          logo_light: string | null
          meta_description: string | null
          og_image: string | null
          pwa_icon_192: string | null
          pwa_icon_512: string | null
          site_title: string | null
          splash_background_color: string | null
          splash_logo: string | null
          system_logo: string | null
          system_name: string
          system_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_keywords?: string | null
          favicon_url?: string | null
          id?: string
          logo_dark?: string | null
          logo_light?: string | null
          meta_description?: string | null
          og_image?: string | null
          pwa_icon_192?: string | null
          pwa_icon_512?: string | null
          site_title?: string | null
          splash_background_color?: string | null
          splash_logo?: string | null
          system_logo?: string | null
          system_name?: string
          system_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_keywords?: string | null
          favicon_url?: string | null
          id?: string
          logo_dark?: string | null
          logo_light?: string | null
          meta_description?: string | null
          og_image?: string | null
          pwa_icon_192?: string | null
          pwa_icon_512?: string | null
          site_title?: string | null
          splash_background_color?: string | null
          splash_logo?: string | null
          system_logo?: string | null
          system_name?: string
          system_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      platform_whatsapp_automations: {
        Row: {
          created_at: string | null
          daily_limit: number | null
          delay_minutes: number | null
          enabled: boolean | null
          id: string
          template_id: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          daily_limit?: number | null
          delay_minutes?: number | null
          enabled?: boolean | null
          id?: string
          template_id?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          daily_limit?: number | null
          delay_minutes?: number | null
          enabled?: boolean | null
          id?: string
          template_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_whatsapp_automations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "platform_whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_whatsapp_logs: {
        Row: {
          company_id: string | null
          created_at: string | null
          error: string | null
          id: string
          message: string
          recipient_phone: string
          recipient_user_id: string | null
          status: string
          type: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          message: string
          recipient_phone: string
          recipient_user_id?: string | null
          status: string
          type: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          message?: string
          recipient_phone?: string
          recipient_user_id?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_whatsapp_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_whatsapp_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_whatsapp_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "platform_whatsapp_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_whatsapp_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_whatsapp_logs_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_whatsapp_logs_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_whatsapp_settings: {
        Row: {
          connected_phone: string | null
          created_at: string | null
          id: string
          instance_id: string | null
          instance_name: string
          last_connected_at: string | null
          qr_code: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          connected_phone?: string | null
          created_at?: string | null
          id?: string
          instance_id?: string | null
          instance_name: string
          last_connected_at?: string | null
          qr_code?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          connected_phone?: string | null
          created_at?: string | null
          id?: string
          instance_id?: string | null
          instance_name?: string
          last_connected_at?: string | null
          qr_code?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      platform_whatsapp_templates: {
        Row: {
          active: boolean | null
          content: string
          created_at: string | null
          id: string
          name: string
          type: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          content: string
          created_at?: string | null
          id?: string
          name: string
          type: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          content?: string
          created_at?: string | null
          id?: string
          name?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
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
            foreignKeyName: "professional_working_hours_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_working_hours_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "professional_working_hours_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_working_hours_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
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
          banner_url: string | null
          bio: string | null
          birth_date: string | null
          company_id: string | null
          created_at: string
          email: string | null
          expected_return_date: string | null
          full_name: string
          id: string
          last_login_mode: string | null
          last_visit_date: string | null
          onboarding_completed: boolean | null
          onboarding_hidden: boolean | null
          onboarding_step: number | null
          opt_in_date: string | null
          opt_in_whatsapp: boolean
          role: string | null
          social_links: Json | null
          system_role: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          average_return_days?: number | null
          banner_url?: string | null
          bio?: string | null
          birth_date?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          expected_return_date?: string | null
          full_name: string
          id?: string
          last_login_mode?: string | null
          last_visit_date?: string | null
          onboarding_completed?: boolean | null
          onboarding_hidden?: boolean | null
          onboarding_step?: number | null
          opt_in_date?: string | null
          opt_in_whatsapp?: boolean
          role?: string | null
          social_links?: Json | null
          system_role?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          average_return_days?: number | null
          banner_url?: string | null
          bio?: string | null
          birth_date?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          expected_return_date?: string | null
          full_name?: string
          id?: string
          last_login_mode?: string | null
          last_visit_date?: string | null
          onboarding_completed?: boolean | null
          onboarding_hidden?: boolean | null
          onboarding_step?: number | null
          opt_in_date?: string | null
          opt_in_whatsapp?: boolean
          role?: string | null
          social_links?: Json | null
          system_role?: string | null
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
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_bookings: {
        Row: {
          appointment_id: string | null
          client_id: string | null
          company_id: string
          created_at: string
          id: string
          promotion_id: string
        }
        Insert: {
          appointment_id?: string | null
          client_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          promotion_id: string
        }
        Update: {
          appointment_id?: string | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          promotion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_bookings_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_bookings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_bookings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_bookings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "promotion_bookings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_bookings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_bookings_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_bookings_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "public_promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_campaign_logs: {
        Row: {
          campaign_id: string
          client_id: string | null
          company_id: string
          created_at: string
          error_message: string | null
          id: string
          message_body: string | null
          processed_at: string | null
          sent_at: string | null
          status: string
          whatsapp: string
        }
        Insert: {
          campaign_id: string
          client_id?: string | null
          company_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          message_body?: string | null
          processed_at?: string | null
          sent_at?: string | null
          status?: string
          whatsapp: string
        }
        Update: {
          campaign_id?: string
          client_id?: string | null
          company_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          message_body?: string | null
          processed_at?: string | null
          sent_at?: string | null
          status?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_campaign_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "promotion_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_campaign_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_campaign_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_campaign_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_campaign_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "promotion_campaign_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_campaign_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_campaigns: {
        Row: {
          company_id: string
          completed_at: string | null
          created_at: string
          error_count: number
          id: string
          last_error: string | null
          message_body: string
          opt_out_count: number
          professional_id: string | null
          promotion_id: string | null
          skipped_count: number
          started_at: string | null
          status: string
          success_count: number
          title: string
          total_clients: number
          updated_at: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          created_at?: string
          error_count?: number
          id?: string
          last_error?: string | null
          message_body: string
          opt_out_count?: number
          professional_id?: string | null
          promotion_id?: string | null
          skipped_count?: number
          started_at?: string | null
          status?: string
          success_count?: number
          title: string
          total_clients?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_at?: string
          error_count?: number
          id?: string
          last_error?: string | null
          message_body?: string
          opt_out_count?: number
          professional_id?: string | null
          promotion_id?: string | null
          skipped_count?: number
          started_at?: string | null
          status?: string
          success_count?: number
          title?: string
          total_clients?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "promotion_campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_campaigns_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_campaigns_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_campaigns_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_campaigns_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "public_promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_clicks: {
        Row: {
          client_id: string | null
          company_id: string
          created_at: string
          id: string
          promotion_id: string
        }
        Insert: {
          client_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          promotion_id: string
        }
        Update: {
          client_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          promotion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_clicks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_clicks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_clicks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_clicks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "promotion_clicks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_clicks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_clicks_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_clicks_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "public_promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotional_opt_outs: {
        Row: {
          company_id: string
          created_at: string
          id: string
          whatsapp: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          whatsapp: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotional_opt_outs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotional_opt_outs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotional_opt_outs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "promotional_opt_outs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotional_opt_outs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          booking_closes_at: string | null
          booking_opens_at: string | null
          cashback_cumulative: boolean
          cashback_rules_text: string | null
          cashback_validity_days: number | null
          client_filter: string
          client_filter_value: number | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          discount_type: string
          discount_value: number | null
          end_date: string
          end_time: string | null
          id: string
          max_slots: number
          message_template: string | null
          min_interval_minutes: number | null
          original_price: number | null
          professional_filter: string
          professional_ids: string[] | null
          promotion_mode: string | null
          promotion_price: number | null
          promotion_type: string
          service_id: string | null
          service_ids: string[] | null
          slug: string | null
          source_insight: string | null
          start_date: string
          start_time: string | null
          status: string
          title: string
          updated_at: string
          use_business_hours: boolean | null
          used_slots: number
          valid_days: number[] | null
        }
        Insert: {
          booking_closes_at?: string | null
          booking_opens_at?: string | null
          cashback_cumulative?: boolean
          cashback_rules_text?: string | null
          cashback_validity_days?: number | null
          client_filter?: string
          client_filter_value?: number | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number | null
          end_date: string
          end_time?: string | null
          id?: string
          max_slots?: number
          message_template?: string | null
          min_interval_minutes?: number | null
          original_price?: number | null
          professional_filter?: string
          professional_ids?: string[] | null
          promotion_mode?: string | null
          promotion_price?: number | null
          promotion_type?: string
          service_id?: string | null
          service_ids?: string[] | null
          slug?: string | null
          source_insight?: string | null
          start_date: string
          start_time?: string | null
          status?: string
          title: string
          updated_at?: string
          use_business_hours?: boolean | null
          used_slots?: number
          valid_days?: number[] | null
        }
        Update: {
          booking_closes_at?: string | null
          booking_opens_at?: string | null
          cashback_cumulative?: boolean
          cashback_rules_text?: string | null
          cashback_validity_days?: number | null
          client_filter?: string
          client_filter_value?: number | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number | null
          end_date?: string
          end_time?: string | null
          id?: string
          max_slots?: number
          message_template?: string | null
          min_interval_minutes?: number | null
          original_price?: number | null
          professional_filter?: string
          professional_ids?: string[] | null
          promotion_mode?: string | null
          promotion_price?: number | null
          promotion_type?: string
          service_id?: string | null
          service_ids?: string[] | null
          slug?: string | null
          source_insight?: string | null
          start_date?: string
          start_time?: string | null
          status?: string
          title?: string
          updated_at?: string
          use_business_hours?: boolean | null
          used_slots?: number
          valid_days?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "promotions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "promotions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "promotions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      push_logs: {
        Row: {
          body: string | null
          company_id: string | null
          created_at: string | null
          error_message: string | null
          event_type: string
          failed_count: number | null
          id: string
          sent_count: number | null
          status: string | null
          title: string
          url: string | null
          user_id: string | null
        }
        Insert: {
          body?: string | null
          company_id?: string | null
          created_at?: string | null
          error_message?: string | null
          event_type: string
          failed_count?: number | null
          id?: string
          sent_count?: number | null
          status?: string | null
          title: string
          url?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string | null
          company_id?: string | null
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          failed_count?: number | null
          id?: string
          sent_count?: number | null
          status?: string | null
          title?: string
          url?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "push_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          device_name: string | null
          endpoint: string
          id: string
          last_seen_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          device_name?: string | null
          endpoint: string
          id?: string
          last_seen_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          device_name?: string | null
          endpoint?: string
          id?: string
          last_seen_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          appointment_id: string | null
          barbershop_comment: string | null
          barbershop_rating: number | null
          client_id: string | null
          comment: string | null
          company_id: string
          created_at: string
          id: string
          professional_id: string
          rating: number
          review_type: string | null
        }
        Insert: {
          appointment_id?: string | null
          barbershop_comment?: string | null
          barbershop_rating?: number | null
          client_id?: string | null
          comment?: string | null
          company_id: string
          created_at?: string
          id?: string
          professional_id: string
          rating: number
          review_type?: string | null
        }
        Update: {
          appointment_id?: string | null
          barbershop_comment?: string | null
          barbershop_rating?: number | null
          client_id?: string | null
          comment?: string | null
          company_id?: string
          created_at?: string
          id?: string
          professional_id?: string
          rating?: number
          review_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          company_id: string
          created_at: string | null
          global_category_id: string | null
          id: string
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          global_category_id?: string | null
          id?: string
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          global_category_id?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "service_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_categories_global_category_id_fkey"
            columns: ["global_category_id"]
            isOneToOne: false
            referencedRelation: "service_categories_global"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories_global: {
        Row: {
          created_at: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      service_professionals: {
        Row: {
          company_id: string | null
          duration_override: number | null
          id: string
          is_active: boolean | null
          price_override: number | null
          professional_id: string
          service_id: string
        }
        Insert: {
          company_id?: string | null
          duration_override?: number | null
          id?: string
          is_active?: boolean | null
          price_override?: number | null
          professional_id: string
          service_id: string
        }
        Update: {
          company_id?: string | null
          duration_override?: number | null
          id?: string
          is_active?: boolean | null
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
            foreignKeyName: "service_professionals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_professionals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "service_professionals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_professionals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
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
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["service_id"]
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
      service_templates: {
        Row: {
          business_category_id: string | null
          created_at: string | null
          duration_minutes: number
          global_category_id: string | null
          id: string
          is_active: boolean | null
          name: string
          suggested_price: number
          version: number | null
        }
        Insert: {
          business_category_id?: string | null
          created_at?: string | null
          duration_minutes: number
          global_category_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          suggested_price: number
          version?: number | null
        }
        Update: {
          business_category_id?: string | null
          created_at?: string | null
          duration_minutes?: number
          global_category_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          suggested_price?: number
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_templates_business_category_id_fkey"
            columns: ["business_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_templates_global_category_id_fkey"
            columns: ["global_category_id"]
            isOneToOne: false
            referencedRelation: "service_categories_global"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          booking_mode: string
          category_id: string | null
          company_id: string
          created_at: string
          duration_minutes: number
          global_category_id: string
          id: string
          name: string
          price: number
          recommended_return_days: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          booking_mode?: string
          category_id?: string | null
          company_id: string
          created_at?: string
          duration_minutes: number
          global_category_id: string
          id?: string
          name: string
          price: number
          recommended_return_days?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          booking_mode?: string
          category_id?: string | null
          company_id?: string
          created_at?: string
          duration_minutes?: number
          global_category_id?: string
          id?: string
          name?: string
          price?: number
          recommended_return_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_global_category_id_fkey"
            columns: ["global_category_id"]
            isOneToOne: false
            referencedRelation: "service_categories_global"
            referencedColumns: ["id"]
          },
        ]
      }
      states: {
        Row: {
          created_at: string | null
          id: string
          name: string
          uf: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          uf: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          uf?: string
        }
        Relationships: []
      }
      subcategories: {
        Row: {
          category_id: string
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          category_id: string
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          category_id?: string
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          company_id: string | null
          created_at: string
          environment: string
          event_type: string
          id: string
          paddle_customer_id: string | null
          paddle_event_id: string | null
          paddle_subscription_id: string | null
          payload: Json | null
          status: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          environment?: string
          event_type: string
          id?: string
          paddle_customer_id?: string | null
          paddle_event_id?: string | null
          paddle_subscription_id?: string | null
          payload?: Json | null
          status?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          environment?: string
          event_type?: string
          id?: string
          paddle_customer_id?: string | null
          paddle_event_id?: string | null
          paddle_subscription_id?: string | null
          payload?: Json | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "subscription_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
        ]
      }
      support_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_url: string
          id: string
          message_id: string | null
          ticket_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number
          file_url: string
          id?: string
          message_id?: string | null
          ticket_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_url?: string
          id?: string
          message_id?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "support_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
          message: string
          ticket_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin?: boolean
          message: string
          ticket_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
          message?: string
          ticket_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_attachments: {
        Row: {
          created_at: string | null
          file_name: string
          file_path: string
          file_type: string | null
          id: string
          message_id: string | null
          ticket_id: string | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_path: string
          file_type?: string | null
          id?: string
          message_id?: string | null
          ticket_id?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_type?: string | null
          id?: string
          message_id?: string | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "support_ticket_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_messages: {
        Row: {
          created_at: string | null
          id: string
          message: string
          sender_id: string | null
          sender_type: string
          ticket_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          sender_id?: string | null
          sender_type: string
          ticket_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          sender_id?: string | null
          sender_type?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: string
          company_id: string
          created_at: string
          description: string
          id: string
          priority: string
          protocol_number: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          company_id: string
          created_at?: string
          description: string
          id?: string
          priority?: string
          protocol_number?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string
          description?: string
          id?: string
          priority?: string
          protocol_number?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "support_tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
        ]
      }
      tutorial_categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      tutorial_videos: {
        Row: {
          active: boolean
          category_id: string | null
          created_at: string
          description: string | null
          duration: string | null
          id: string
          menu_reference: string | null
          sort_order: number
          thumbnail_url: string | null
          title: string
          updated_at: string
          visible_for: string
          youtube_url: string
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          duration?: string | null
          id?: string
          menu_reference?: string | null
          sort_order?: number
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          visible_for?: string
          youtube_url: string
        }
        Update: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          duration?: string | null
          id?: string
          menu_reference?: string | null
          sort_order?: number
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          visible_for?: string
          youtube_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutorial_videos_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "tutorial_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_onboarding: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tutorial_progress: {
        Row: {
          completed_at: string
          id: string
          user_id: string
          video_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          user_id: string
          video_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tutorial_progress_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "tutorial_videos"
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
          time_from: string | null
          time_to: string | null
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
          time_from?: string | null
          time_to?: string | null
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
          time_from?: string | null
          time_to?: string | null
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
            foreignKeyName: "waiting_list_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_list_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "waiting_list_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_list_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
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
          client_id: string | null
          client_name: string | null
          client_whatsapp: string | null
          company_id: string
          created_at: string
          desired_date: string
          email: string | null
          event_id: string | null
          id: string
          notified: boolean
          professional_id: string | null
          service_ids: string[]
          status: string
          time_from: string | null
          time_to: string | null
        }
        Insert: {
          client_id?: string | null
          client_name?: string | null
          client_whatsapp?: string | null
          company_id: string
          created_at?: string
          desired_date: string
          email?: string | null
          event_id?: string | null
          id?: string
          notified?: boolean
          professional_id?: string | null
          service_ids: string[]
          status?: string
          time_from?: string | null
          time_to?: string | null
        }
        Update: {
          client_id?: string | null
          client_name?: string | null
          client_whatsapp?: string | null
          company_id?: string
          created_at?: string
          desired_date?: string
          email?: string | null
          event_id?: string | null
          id?: string
          notified?: boolean
          professional_id?: string | null
          service_ids?: string[]
          status?: string
          time_from?: string | null
          time_to?: string | null
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
          {
            foreignKeyName: "waitlist_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "waitlist_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
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
          {
            foreignKeyName: "webhook_configs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_configs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "webhook_configs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_configs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
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
          {
            foreignKeyName: "webhook_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "webhook_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_automations: {
        Row: {
          company_id: string
          config: Json
          created_at: string
          daily_limit: number
          delay_minutes: number
          description: string | null
          enabled: boolean
          exclude_blocked: boolean
          id: string
          name: string
          send_window_end: string
          send_window_start: string
          template_id: string | null
          trigger: Database["public"]["Enums"]["whatsapp_automation_trigger"]
          updated_at: string
          weekdays: number[]
        }
        Insert: {
          company_id: string
          config?: Json
          created_at?: string
          daily_limit?: number
          delay_minutes?: number
          description?: string | null
          enabled?: boolean
          exclude_blocked?: boolean
          id?: string
          name: string
          send_window_end?: string
          send_window_start?: string
          template_id?: string | null
          trigger: Database["public"]["Enums"]["whatsapp_automation_trigger"]
          updated_at?: string
          weekdays?: number[]
        }
        Update: {
          company_id?: string
          config?: Json
          created_at?: string
          daily_limit?: number
          delay_minutes?: number
          description?: string | null
          enabled?: boolean
          exclude_blocked?: boolean
          id?: string
          name?: string
          send_window_end?: string
          send_window_start?: string
          template_id?: string | null
          trigger?: Database["public"]["Enums"]["whatsapp_automation_trigger"]
          updated_at?: string
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_automations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          company_id: string
          connected_at: string | null
          created_at: string
          id: string
          instance_id: string | null
          instance_name: string | null
          last_seen_at: string | null
          metadata: Json
          phone: string | null
          profile_name: string | null
          qr_code: string | null
          session_name: string | null
          status: Database["public"]["Enums"]["whatsapp_status"]
          updated_at: string
        }
        Insert: {
          company_id: string
          connected_at?: string | null
          created_at?: string
          id?: string
          instance_id?: string | null
          instance_name?: string | null
          last_seen_at?: string | null
          metadata?: Json
          phone?: string | null
          profile_name?: string | null
          qr_code?: string | null
          session_name?: string | null
          status?: Database["public"]["Enums"]["whatsapp_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          connected_at?: string | null
          created_at?: string
          id?: string
          instance_id?: string | null
          instance_name?: string | null
          last_seen_at?: string | null
          metadata?: Json
          phone?: string | null
          profile_name?: string | null
          qr_code?: string | null
          session_name?: string | null
          status?: Database["public"]["Enums"]["whatsapp_status"]
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_logs: {
        Row: {
          appointment_id: string | null
          automation_id: string | null
          body: string
          client_id: string | null
          client_name: string | null
          company_id: string
          created_at: string
          delivered_at: string | null
          error_message: string | null
          id: string
          message_type: string
          phone: string
          read_at: string | null
          source: string | null
          status: Database["public"]["Enums"]["whatsapp_message_status"]
          template_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          automation_id?: string | null
          body: string
          client_id?: string | null
          client_name?: string | null
          company_id: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          message_type?: string
          phone: string
          read_at?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["whatsapp_message_status"]
          template_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          automation_id?: string | null
          body?: string
          client_id?: string | null
          client_name?: string | null
          company_id?: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          message_type?: string
          phone?: string
          read_at?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["whatsapp_message_status"]
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_logs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_metrics: {
        Row: {
          company_id: string
          created_at: string
          delivered_count: number
          failed_count: number
          id: string
          metric_date: string
          read_count: number
          reply_count: number
          sent_count: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          delivered_count?: number
          failed_count?: number
          id?: string
          metric_date: string
          read_count?: number
          reply_count?: number
          sent_count?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          delivered_count?: number
          failed_count?: number
          id?: string
          metric_date?: string
          read_count?: number
          reply_count?: number
          sent_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_otp_codes: {
        Row: {
          code: string
          company_id: string | null
          created_at: string | null
          email: string | null
          expires_at: string
          id: string
          phone: string
          verified: boolean | null
        }
        Insert: {
          code: string
          company_id?: string | null
          created_at?: string | null
          email?: string | null
          expires_at: string
          id?: string
          phone: string
          verified?: boolean | null
        }
        Update: {
          code?: string
          company_id?: string | null
          created_at?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          phone?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          body: string
          category: string
          company_id: string
          created_at: string
          id: string
          is_system: boolean
          name: string
          updated_at: string
          variables: string[]
        }
        Insert: {
          body: string
          category?: string
          company_id: string
          created_at?: string
          id?: string
          is_system?: boolean
          name: string
          updated_at?: string
          variables?: string[]
        }
        Update: {
          body?: string
          category?: string
          company_id?: string
          created_at?: string
          id?: string
          is_system?: boolean
          name?: string
          updated_at?: string
          variables?: string[]
        }
        Relationships: []
      }
    }
    Views: {
      companies_billing: {
        Row: {
          id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      marketplace_active_services: {
        Row: {
          company_id: string | null
          company_name: string | null
          company_slug: string | null
          duration: number | null
          global_category_id: string | null
          global_category_name: string | null
          global_category_slug: string | null
          price: number | null
          service_id: string | null
          service_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_global_category_id_fkey"
            columns: ["global_category_id"]
            isOneToOne: false
            referencedRelation: "service_categories_global"
            referencedColumns: ["id"]
          },
        ]
      }
      public_blocked_times: {
        Row: {
          block_date: string | null
          company_id: string | null
          end_time: string | null
          id: string | null
          professional_id: string | null
          start_time: string | null
        }
        Insert: {
          block_date?: string | null
          company_id?: string | null
          end_time?: string | null
          id?: string | null
          professional_id?: string | null
          start_time?: string | null
        }
        Update: {
          block_date?: string | null
          company_id?: string | null
          end_time?: string | null
          id?: string | null
          professional_id?: string | null
          start_time?: string | null
        }
        Relationships: []
      }
      public_company: {
        Row: {
          address: string | null
          address_number: string | null
          allow_custom_requests: boolean | null
          average_rating: number | null
          booking_mode: string | null
          buffer_minutes: number | null
          business_type: Database["public"]["Enums"]["business_type"] | null
          city: string | null
          cover_url: string | null
          description: string | null
          district: string | null
          facebook: string | null
          fixed_slot_interval: number | null
          google_maps_url: string | null
          google_review_url: string | null
          id: string | null
          instagram: string | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string | null
          phone: string | null
          postal_code: string | null
          review_count: number | null
          slug: string | null
          state: string | null
          website: string | null
          whatsapp: string | null
        }
        Relationships: []
      }
      public_company_settings: {
        Row: {
          background_color: string | null
          booking_buffer_minutes: number | null
          company_id: string | null
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          timezone: string | null
        }
        Insert: {
          background_color?: string | null
          booking_buffer_minutes?: number | null
          company_id?: string | null
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          timezone?: string | null
        }
        Update: {
          background_color?: string | null
          booking_buffer_minutes?: number | null
          company_id?: string | null
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          timezone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
        ]
      }
      public_company_view: {
        Row: {
          business_type: Database["public"]["Enums"]["business_type"] | null
          city: string | null
          created_at: string | null
          id: string | null
          name: string | null
          slug: string | null
          state: string | null
        }
        Insert: {
          business_type?: Database["public"]["Enums"]["business_type"] | null
          city?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          slug?: string | null
          state?: string | null
        }
        Update: {
          business_type?: Database["public"]["Enums"]["business_type"] | null
          city?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          slug?: string | null
          state?: string | null
        }
        Relationships: []
      }
      public_professionals: {
        Row: {
          active: boolean | null
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          booking_mode: string | null
          break_time: number | null
          company_id: string | null
          grid_interval: number | null
          id: string | null
          name: string | null
          slug: string | null
          social_links: Json | null
          whatsapp: string | null
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
            foreignKeyName: "collaborators_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborators_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "collaborators_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborators_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
        ]
      }
      public_promotions: {
        Row: {
          booking_closes_at: string | null
          booking_opens_at: string | null
          cashback_rules_text: string | null
          cashback_validity_days: number | null
          company_id: string | null
          created_by: string | null
          description: string | null
          discount_type: string | null
          discount_value: number | null
          end_date: string | null
          end_time: string | null
          id: string | null
          max_slots: number | null
          original_price: number | null
          professional_filter: string | null
          professional_ids: string[] | null
          promotion_price: number | null
          promotion_type: string | null
          service_duration: number | null
          service_id: string | null
          service_ids: string[] | null
          service_name: string | null
          slug: string | null
          start_date: string | null
          start_time: string | null
          status: string | null
          title: string | null
          used_slots: number | null
        }
        Relationships: [
          {
            foreignKeyName: "promotions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "promotions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "promotions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
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
          {
            foreignKeyName: "services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "marketplace_active_services"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_company_view"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_pending_plan_changes: { Args: never; Returns: Json }
      apply_super_admin_role: {
        Args: { target_email: string; target_user_id: string }
        Returns: undefined
      }
      book_open_agenda_slot_v2: {
        Args: {
          p_client_email?: string
          p_client_name: string
          p_client_whatsapp: string
          p_notes?: string
          p_service_ids?: string[]
          p_slot_id: string
        }
        Returns: {
          appointment_id: string
          message: string
          success: boolean
        }[]
      }
      can_access_company: { Args: { _company_id: string }; Returns: boolean }
      can_manage_company: { Args: { _company_id: string }; Returns: boolean }
      cancel_appointment_public: {
        Args: { p_appointment_id: string }
        Returns: Json
      }
      check_client_existence: {
        Args: { p_email: string; p_whatsapp: string }
        Returns: {
          client_email: string
          client_name: string
          client_whatsapp: string
          email_found: boolean
          exists_globally: boolean
          whatsapp_found: boolean
        }[]
      }
      check_client_registration: {
        Args: { p_client_id: string }
        Returns: boolean
      }
      check_identification:
        | { Args: { p_email: string; p_whatsapp: string }; Returns: Json }
        | {
            Args: { p_company_id?: string; p_email: string; p_whatsapp: string }
            Returns: Json
          }
      cleanup_expired_otp: { Args: never; Returns: undefined }
      complete_client_signup: {
        Args: {
          p_birth_date?: string
          p_company_id: string
          p_email?: string
          p_name: string
          p_whatsapp?: string
        }
        Returns: string
      }
      confirm_reward_redemption: { Args: { p_code: string }; Returns: Json }
      confirm_suggested_request: {
        Args: { p_request_id: string }
        Returns: Json
      }
      create_appointment: {
        Args: {
          p_booking_origin?: string
          p_client_id: string
          p_client_name?: string
          p_client_whatsapp?: string
          p_end_time: string
          p_notes?: string
          p_professional_id: string
          p_promotion_id?: string
          p_start_time: string
          p_total_price?: number
        }
        Returns: string
      }
      create_appointment_services: {
        Args: { p_appointment_id: string; p_services: Json }
        Returns: undefined
      }
      create_appointment_v2: {
        Args: {
          p_booking_origin?: string
          p_cashback_ids?: string[]
          p_client_email?: string
          p_client_id: string
          p_client_name: string
          p_client_whatsapp: string
          p_company_id: string
          p_end_time: string
          p_extra_fee?: number
          p_extra_fee_type?: string
          p_extra_fee_value?: number
          p_notes?: string
          p_professional_id: string
          p_promotion_id?: string
          p_services?: Json
          p_special_schedule?: boolean
          p_start_time: string
          p_total_price: number
          p_user_id?: string
        }
        Returns: string
      }
      create_client: {
        Args: {
          p_birth_date?: string
          p_company_id: string
          p_email?: string
          p_name: string
          p_whatsapp: string
        }
        Returns: string
      }
      delete_user_completely: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      expire_old_waitlist_entries: { Args: never; Returns: undefined }
      expire_pending_redemptions: {
        Args: { p_minutes?: number }
        Returns: Json
      }
      expire_trials_and_grace: { Args: never; Returns: Json }
      get_appointment_public: {
        Args: { p_appointment_id: string }
        Returns: Json
      }
      get_booking_appointments: {
        Args: {
          p_company_id: string
          p_professional_id: string
          p_selected_date: string
          p_timezone?: string
        }
        Returns: {
          end_time: string
          start_time: string
          status: string
        }[]
      }
      get_client_appointments_v2: {
        Args: never
        Returns: {
          appointment_services: Json
          cashback_used: number
          client_email: string
          client_name: string
          client_whatsapp: string
          company: Json
          company_id: string
          end_time: string
          final_price: number
          id: string
          manual_discount: number
          original_price: number
          professional: Json
          promotion_discount: number
          promotion_id: string
          start_time: string
          status: string
          total_price: number
          user_id: string
        }[]
      }
      get_client_cashback_balance: {
        Args: {
          p_client_id?: string
          p_company_id: string
          p_email?: string
          p_user_id?: string
          p_whatsapp?: string
        }
        Returns: number
      }
      get_client_identity_v2: {
        Args: never
        Returns: {
          client_ids: string[]
          emails: string[]
          whatsapps: string[]
        }[]
      }
      get_client_loyalty_balance: {
        Args: {
          p_client_id?: string
          p_company_id: string
          p_email?: string
          p_user_id?: string
          p_whatsapp?: string
        }
        Returns: number
      }
      get_client_portal_appointments: { Args: never; Returns: Json[] }
      get_client_portal_cashback: { Args: never; Returns: Json }
      get_client_portal_points: { Args: never; Returns: Json }
      get_client_portal_summary: { Args: never; Returns: Json }
      get_company_by_slug: {
        Args: { _slug: string }
        Returns: {
          address: string
          business_type: Database["public"]["Enums"]["business_type"]
          cover_url: string
          google_review_url: string
          id: string
          logo_url: string
          name: string
          phone: string
          slug: string
        }[]
      }
      get_company_dashboard_stats: {
        Args: { p_company_id: string; p_professional_id?: string }
        Returns: {
          new_clients_month: number
          top_client_count: number
          top_client_name: string
          total_appointments: number
          total_clients: number
        }[]
      }
      get_current_user_context: {
        Args: never
        Returns: {
          company_id: string
          email: string
          full_name: string
          is_collaborator: boolean
          is_owner: boolean
          login_mode: string
          profile_id: string
          roles: string[]
          user_id: string
        }[]
      }
      get_marketplace_banner_daily_stats: {
        Args: {
          p_banner_id: string
          p_end_date?: string
          p_start_date?: string
        }
        Returns: {
          r_clicks: number
          r_ctr: number
          r_impressions: number
          r_stat_date: string
        }[]
      }
      get_marketplace_banner_report: {
        Args: {
          p_advertiser?: string
          p_banner_id?: string
          p_category?: string
          p_city?: string
          p_end_date?: string
          p_position?: string
          p_start_date?: string
          p_state?: string
          p_status?: string
        }
        Returns: {
          r_banner_id: string
          r_category: string
          r_city: string
          r_clicks: number
          r_client_name: string
          r_ctr: number
          r_end_date: string
          r_impressions: number
          r_limit_clicks: number
          r_limit_impressions: number
          r_name: string
          r_position: string
          r_sale_model: string
          r_start_date: string
          r_state: string
          r_status: string
        }[]
      }
      get_marketplace_featured_items:
        | {
            Args: {
              p_category?: string
              p_city_id?: string
              p_highlight_type: string
              p_state_id?: string
              p_user_lat?: number
              p_user_lon?: number
            }
            Returns: {
              company_id: string
              highlight_type: string
              id: string
              item_details: Json
              item_type: string
              professional_id: string
              relevance_score: number
            }[]
          }
        | {
            Args: {
              p_city?: string
              p_highlight_type: string
              p_limit?: number
            }
            Returns: {
              average_rating: number
              business_type: string
              city: string
              cover_url: string
              id: string
              is_manual: boolean
              item_id: string
              item_type: string
              latitude: number
              logo_url: string
              longitude: number
              name: string
              priority: number
              review_count: number
              slug: string
              state: string
            }[]
          }
      get_my_company_id: { Args: never; Returns: string }
      get_my_profile_id: { Args: never; Returns: string }
      get_or_create_revenue_category: {
        Args: { p_company_id: string; p_name: string }
        Returns: string
      }
      get_professional_ratings: {
        Args: { p_company_id: string }
        Returns: {
          avg_rating: number
          professional_id: string
          review_count: number
        }[]
      }
      get_professional_recent_bookings: {
        Args: { p_professional_id: string }
        Returns: number
      }
      get_user_companies: {
        Args: never
        Returns: {
          company_id: string
          company_logo: string
          company_name: string
          company_slug: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
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
      initialize_company_whatsapp_defaults: {
        Args: { p_company_id: string }
        Returns: undefined
      }
      initialize_company_whatsapp_templates: {
        Args: { p_company_id: string }
        Returns: undefined
      }
      is_admin: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_company_active: { Args: { p_company_id: string }; Returns: boolean }
      is_company_admin: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_company_readonly: { Args: { p_company_id: string }; Returns: boolean }
      is_professional: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      join_public_waitlist:
        | {
            Args: {
              p_client_name: string
              p_client_whatsapp: string
              p_company_id: string
              p_desired_date: string
              p_email: string
              p_professional_id?: string
              p_service_ids: string[]
            }
            Returns: string
          }
        | {
            Args: {
              p_client_name: string
              p_client_whatsapp: string
              p_company_id: string
              p_desired_date: string
              p_email: string
              p_professional_id?: string
              p_service_ids: string[]
              p_time_from?: string
              p_time_to?: string
            }
            Returns: string
          }
      link_client_globally: {
        Args: {
          p_company_id: string
          p_email: string
          p_name?: string
          p_phone: string
          p_user_id: string
        }
        Returns: undefined
      }
      link_client_to_user:
        | { Args: { p_phone: string; p_user_id: string }; Returns: undefined }
        | {
            Args: { p_email?: string; p_phone?: string; p_user_id: string }
            Returns: number
          }
      lookup_client_by_whatsapp: {
        Args: { p_company_id: string; p_whatsapp: string }
        Returns: {
          email: string
          id: string
          name: string
          whatsapp: string
        }[]
      }
      lookup_client_globally:
        | {
            Args: { input_whatsapp: string }
            Returns: {
              global_id: string
              global_name: string
              global_whatsapp: string
              local_client_id: string
            }[]
          }
        | {
            Args: { input_whatsapp: string; p_company_id: string }
            Returns: {
              global_email: string
              global_id: string
              global_name: string
              global_whatsapp: string
              local_client_id: string
            }[]
          }
      normalize_slug: { Args: { input_text: string }; Returns: string }
      normalize_whatsapp_v2: { Args: { phone: string }; Returns: string }
      recalculate_client_return_stats: {
        Args: { _company_id: string }
        Returns: undefined
      }
      redeem_reward: {
        Args: { p_client_id: string; p_company_id: string; p_reward_id: string }
        Returns: Json
      }
      register_delay:
        | {
            Args: { p_appointment_id: string; p_delay_minutes: number }
            Returns: Json
          }
        | {
            Args: {
              p_appointment_id: string
              p_delay_minutes: number
              p_stop_before?: string
            }
            Returns: Json
          }
      register_promotional_opt_out: {
        Args: { p_company_id: string; p_whatsapp: string }
        Returns: undefined
      }
      reject_suggested_request: {
        Args: { p_request_id: string }
        Returns: Json
      }
      reschedule_appointment: {
        Args: {
          p_appointment_id: string
          p_new_end: string
          p_new_start: string
        }
        Returns: Json
      }
      submit_review:
        | {
            Args: {
              p_appointment_id: string
              p_comment?: string
              p_rating: number
            }
            Returns: string
          }
        | {
            Args: {
              p_appointment_id: string
              p_barbershop_rating?: number
              p_comment?: string
              p_rating: number
            }
            Returns: string
          }
        | {
            Args: {
              p_appointment_id: string
              p_barbershop_comment?: string
              p_barbershop_rating?: number
              p_comment?: string
              p_rating: number
            }
            Returns: string
          }
      swap_appointments: {
        Args: {
          p_appointment_a: string
          p_appointment_b: string
          p_reason?: string
        }
        Returns: Json
      }
      switch_active_company: {
        Args: { _company_id: string }
        Returns: undefined
      }
      sync_marketplace_banner_statuses: { Args: never; Returns: Json }
      sync_marketplace_featured_statuses: { Args: never; Returns: undefined }
      track_booking_metric: {
        Args: {
          p_company_id: string
          p_metadata?: Json
          p_metric_type: string
          p_value?: number
        }
        Returns: undefined
      }
      validate_reward_redemption: { Args: { p_code: string }; Returns: Json }
    }
    Enums: {
      app_role: "super_admin" | "professional" | "collaborator" | "client"
      appointment_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "no_show"
        | "rescheduled"
      business_type: "barbershop" | "esthetic"
      collaborator_type: "partner" | "commissioned" | "independent"
      commission_type: "percentage" | "fixed" | "none" | "own_revenue"
      event_status: "draft" | "published" | "cancelled" | "completed"
      subscription_status:
        | "active"
        | "inactive"
        | "blocked"
        | "trial"
        | "past_due"
        | "expired_trial"
        | "unpaid"
        | "trialing"
        | "canceled"
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
        | "review_request"
      whatsapp_automation_trigger:
        | "appointment_confirmed"
        | "appointment_reminder"
        | "post_service_review"
        | "inactive_client"
        | "birthday"
        | "appointment_cancelled"
        | "appointment_rescheduled"
        | "loyalty_cashback"
        | "waitlist_slot_open"
        | "appointment_reminder_1d"
        | "appointment_reminder_2h"
        | "professional_delay"
        | "promotional"
      whatsapp_message_status:
        | "pending"
        | "sent"
        | "delivered"
        | "read"
        | "failed"
      whatsapp_status:
        | "disconnected"
        | "connecting"
        | "connected"
        | "error"
        | "pending"
        | "closed"
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
        "rescheduled",
      ],
      business_type: ["barbershop", "esthetic"],
      collaborator_type: ["partner", "commissioned", "independent"],
      commission_type: ["percentage", "fixed", "none", "own_revenue"],
      event_status: ["draft", "published", "cancelled", "completed"],
      subscription_status: [
        "active",
        "inactive",
        "blocked",
        "trial",
        "past_due",
        "expired_trial",
        "unpaid",
        "trialing",
        "canceled",
      ],
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
        "review_request",
      ],
      whatsapp_automation_trigger: [
        "appointment_confirmed",
        "appointment_reminder",
        "post_service_review",
        "inactive_client",
        "birthday",
        "appointment_cancelled",
        "appointment_rescheduled",
        "loyalty_cashback",
        "waitlist_slot_open",
        "appointment_reminder_1d",
        "appointment_reminder_2h",
        "professional_delay",
        "promotional",
      ],
      whatsapp_message_status: [
        "pending",
        "sent",
        "delivered",
        "read",
        "failed",
      ],
      whatsapp_status: [
        "disconnected",
        "connecting",
        "connected",
        "error",
        "pending",
        "closed",
      ],
    },
  },
} as const
