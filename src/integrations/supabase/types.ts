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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          amount: number
          car_make: string
          car_model: string
          car_plate: string
          created_at: string
          id: string
          notes: string | null
          package: Database["public"]["Enums"]["wash_package"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          queue_position: number | null
          scheduled_at: string
          slot_number: number | null
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          car_make: string
          car_model: string
          car_plate: string
          created_at?: string
          id?: string
          notes?: string | null
          package?: Database["public"]["Enums"]["wash_package"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          queue_position?: number | null
          scheduled_at: string
          slot_number?: number | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          car_make?: string
          car_model?: string
          car_plate?: string
          created_at?: string
          id?: string
          notes?: string | null
          package?: Database["public"]["Enums"]["wash_package"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          queue_position?: number | null
          scheduled_at?: string
          slot_number?: number | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      employee_assignments: {
        Row: {
          accepted_at: string | null
          assigned_at: string
          assigned_by: string
          booking_id: string
          completed_at: string | null
          employee_id: string
          id: string
          mismatch_reported_at: string | null
          mismatch_scanned_plate: string | null
          plate_verified_at: string | null
          scanned_plate: string | null
          status: Database["public"]["Enums"]["employee_assignment_status"]
        }
        Insert: {
          accepted_at?: string | null
          assigned_at?: string
          assigned_by: string
          booking_id: string
          completed_at?: string | null
          employee_id: string
          id?: string
          mismatch_reported_at?: string | null
          mismatch_scanned_plate?: string | null
          plate_verified_at?: string | null
          scanned_plate?: string | null
          status?: Database["public"]["Enums"]["employee_assignment_status"]
        }
        Update: {
          accepted_at?: string | null
          assigned_at?: string
          assigned_by?: string
          booking_id?: string
          completed_at?: string | null
          employee_id?: string
          id?: string
          mismatch_reported_at?: string | null
          mismatch_scanned_plate?: string | null
          plate_verified_at?: string | null
          scanned_plate?: string | null
          status?: Database["public"]["Enums"]["employee_assignment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "employee_assignments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_slots: {
        Row: {
          assigned_at: string
          employee_id: string
          id: string
          slot_number: number
        }
        Insert: {
          assigned_at?: string
          employee_id: string
          id?: string
          slot_number: number
        }
        Update: {
          assigned_at?: string
          employee_id?: string
          id?: string
          slot_number?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications_config: {
        Row: {
          created_at: string | null
          id: string
          send_email_notifications: boolean | null
          send_sms_notifications: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          send_email_notifications?: boolean | null
          send_sms_notifications?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          send_email_notifications?: boolean | null
          send_sms_notifications?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string | null
          id: string
          items: Json
          status: string
          total_amount: number
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          items: Json
          status: string
          total_amount: number
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          items?: Json
          status?: string
          total_amount?: number
          user_id?: string | null
        }
        Relationships: []
      }
      paystack_payments: {
        Row: {
          amount: number
          booking_id: string | null
          created_at: string
          currency: string
          id: string
          order_id: string | null
          payment_type: string
          reference: string
          user_id: string
        }
        Insert: {
          amount: number
          booking_id?: string | null
          created_at?: string
          currency: string
          id?: string
          order_id?: string | null
          payment_type: string
          reference: string
          user_id: string
        }
        Update: {
          amount?: number
          booking_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          order_id?: string | null
          payment_type?: string
          reference?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paystack_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paystack_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          id: string
          low_stock_threshold: number
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          id: string
          low_stock_threshold?: number
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          id?: string
          low_stock_threshold?: number
          stock_quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          assigned_slot_number: number | null
          created_at: string
          email: string | null
          free_washes: number
          full_name: string | null
          id: string
          id_number: string | null
          phone: string | null
          reward_points: number
          role: Database["public"]["Enums"]["app_role"]
          surname: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          assigned_slot_number?: number | null
          created_at?: string
          email?: string | null
          free_washes?: number
          full_name?: string | null
          id: string
          id_number?: string | null
          phone?: string | null
          reward_points?: number
          role?: Database["public"]["Enums"]["app_role"]
          surname?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          assigned_slot_number?: number | null
          created_at?: string
          email?: string | null
          free_washes?: number
          full_name?: string | null
          id?: string
          id_number?: string | null
          phone?: string | null
          reward_points?: number
          role?: Database["public"]["Enums"]["app_role"]
          surname?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_assigned_slot_number_fkey"
            columns: ["assigned_slot_number"]
            isOneToOne: false
            referencedRelation: "employee_slots"
            referencedColumns: ["slot_number"]
          },
        ]
      }
      sent_notifications: {
        Row: {
          booking_id: string | null
          channel: string
          id: string
          message: string | null
          sent_at: string | null
          title: string | null
          type: string
          user_id: string
        }
        Insert: {
          booking_id?: string | null
          channel: string
          id?: string
          message?: string | null
          sent_at?: string | null
          title?: string | null
          type: string
          user_id: string
        }
        Update: {
          booking_id?: string | null
          channel?: string
          id?: string
          message?: string | null
          sent_at?: string | null
          title?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sent_notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_invitations: {
        Row: {
          code_hash: string
          created_at: string
          email: string
          expires_at: string
          first_name: string
          id: string
          id_number: string
          invited_by: string
          invited_user_id: string | null
          phone: string
          surname: string
          used_at: string | null
        }
        Insert: {
          code_hash: string
          created_at?: string
          email: string
          expires_at?: string
          first_name: string
          id?: string
          id_number: string
          invited_by: string
          invited_user_id?: string | null
          phone: string
          surname: string
          used_at?: string | null
        }
        Update: {
          code_hash?: string
          created_at?: string
          email?: string
          expires_at?: string
          first_name?: string
          id?: string
          id_number?: string
          invited_by?: string
          invited_user_id?: string | null
          phone?: string
          surname?: string
          used_at?: string | null
        }
        Relationships: []
      }
      staff_leave: {
        Row: {
          attachment_path: string | null
          covering_employee_id: string | null
          created_by: string
          days_count: number | null
          employee_id: string
          end_date: string | null
          ended_at: string | null
          ended_by: string | null
          id: string
          leave_type: Database["public"]["Enums"]["staff_leave_type"]
          reason: string | null
          sick_note_path: string | null
          sick_note_required: boolean
          sick_note_submitted_at: string | null
          slot_number: number
          start_date: string | null
          started_at: string
        }
        Insert: {
          attachment_path?: string | null
          covering_employee_id?: string | null
          created_by: string
          days_count?: number | null
          employee_id: string
          end_date?: string | null
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          leave_type?: Database["public"]["Enums"]["staff_leave_type"]
          reason?: string | null
          sick_note_path?: string | null
          sick_note_required?: boolean
          sick_note_submitted_at?: string | null
          slot_number: number
          start_date?: string | null
          started_at?: string
        }
        Update: {
          attachment_path?: string | null
          covering_employee_id?: string | null
          created_by?: string
          days_count?: number | null
          employee_id?: string
          end_date?: string | null
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          leave_type?: Database["public"]["Enums"]["staff_leave_type"]
          reason?: string | null
          sick_note_path?: string | null
          sick_note_required?: boolean
          sick_note_submitted_at?: string | null
          slot_number?: number
          start_date?: string | null
          started_at?: string
        }
        Relationships: []
      }
      staff_leave_requests: {
        Row: {
          attachment_path: string | null
          days_count: number | null
          decided_at: string | null
          decided_by: string | null
          decision_notes: string | null
          employee_id: string
          end_date: string
          id: string
          leave_type: Database["public"]["Enums"]["staff_leave_type"]
          reason: string
          requested_at: string
          resulting_leave_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["staff_leave_request_status"]
        }
        Insert: {
          attachment_path?: string | null
          days_count?: number | null
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          employee_id: string
          end_date: string
          id?: string
          leave_type: Database["public"]["Enums"]["staff_leave_type"]
          reason: string
          requested_at?: string
          resulting_leave_id?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["staff_leave_request_status"]
        }
        Update: {
          attachment_path?: string | null
          days_count?: number | null
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          employee_id?: string
          end_date?: string
          id?: string
          leave_type?: Database["public"]["Enums"]["staff_leave_type"]
          reason?: string
          requested_at?: string
          resulting_leave_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["staff_leave_request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "staff_leave_requests_resulting_leave_id_fkey"
            columns: ["resulting_leave_id"]
            isOneToOne: false
            referencedRelation: "staff_leave"
            referencedColumns: ["id"]
          },
        ]
      }
      system_reports: {
        Row: {
          created_at: string
          description: string
          id: string
          reported_by: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["system_report_severity"]
          status: Database["public"]["Enums"]["system_report_status"]
          title: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          reported_by: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["system_report_severity"]
          status?: Database["public"]["Enums"]["system_report_status"]
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          reported_by?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["system_report_severity"]
          status?: Database["public"]["Enums"]["system_report_status"]
          title?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_employee_booking: {
        Args: { _assignment_id: string }
        Returns: undefined
      }
      admin_assign_employee: {
        Args: { _booking_id: string; _employee_id: string }
        Returns: undefined
      }
      approve_staff_leave_request: {
        Args: { _covering_employee_id?: string; _request_id: string }
        Returns: string
      }
      assign_leave_cover: {
        Args: { _covering_employee_id: string; _leave_id: string }
        Returns: undefined
      }
      auto_assign_booking_slot: {
        Args: { _booking_id: string }
        Returns: number
      }
      auto_assign_employee_slot: {
        Args: { _employee_id: string }
        Returns: number
      }
      complete_employee_assignment: {
        Args: { _assignment_id: string }
        Returns: undefined
      }
      consume_staff_invitation: {
        Args: { _code_hash: string; _invitation_id: string }
        Returns: number
      }
      decline_staff_leave_request: {
        Args: { _decision_notes: string; _request_id: string }
        Returns: undefined
      }
      end_staff_leave: { Args: { _leave_id: string }; Returns: undefined }
      get_occupied_wash_slots: { Args: never; Returns: number[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_valid_sa_id_number: { Args: { _id: string }; Returns: boolean }
      record_order_stock: { Args: { _items: Json }; Returns: undefined }
      register_employee_with_slot: {
        Args: {
          _email: string
          _full_name: string
          _id_number: string
          _phone: string
          _surname: string
        }
        Returns: Json
      }
      report_system_issue: {
        Args: {
          _description: string
          _severity?: Database["public"]["Enums"]["system_report_severity"]
          _title: string
        }
        Returns: string
      }
      report_vehicle_mismatch: {
        Args: { _assignment_id: string; _scanned_plate: string }
        Returns: undefined
      }
      request_staff_leave: {
        Args: {
          _attachment_path?: string
          _end_date: string
          _leave_type: Database["public"]["Enums"]["staff_leave_type"]
          _reason: string
          _start_date: string
        }
        Returns: string
      }
      resolve_system_report: {
        Args: { _report_id: string; _resolution_notes?: string }
        Returns: undefined
      }
      start_staff_leave: {
        Args: {
          _attachment_path?: string
          _covering_employee_id?: string
          _employee_id: string
          _end_date?: string
          _leave_type?: Database["public"]["Enums"]["staff_leave_type"]
          _reason: string
          _start_date?: string
        }
        Returns: string
      }
      submit_sick_note: {
        Args: { _file_path: string; _leave_id: string }
        Returns: undefined
      }
      username_is_available: { Args: { candidate: string }; Returns: boolean }
      verify_employee_vehicle: {
        Args: { _assignment_id: string; _scanned_plate: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user" | "employee"
      booking_status:
        | "pending"
        | "confirmed"
        | "in_queue"
        | "in_progress"
        | "completed"
        | "cancelled"
      employee_assignment_status: "active" | "completed"
      payment_status: "unpaid" | "paid" | "free"
      staff_leave_request_status: "pending" | "approved" | "declined"
      staff_leave_type: "sick" | "annual" | "other"
      system_report_severity: "low" | "medium" | "high" | "critical"
      system_report_status: "open" | "resolved"
      wash_package: "basic" | "premium" | "deluxe"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "user", "employee"],
      booking_status: [
        "pending",
        "confirmed",
        "in_queue",
        "in_progress",
        "completed",
        "cancelled",
      ],
      employee_assignment_status: ["active", "completed"],
      payment_status: ["unpaid", "paid", "free"],
      staff_leave_request_status: ["pending", "approved", "declined"],
      staff_leave_type: ["sick", "annual", "other"],
      system_report_severity: ["low", "medium", "high", "critical"],
      system_report_status: ["open", "resolved"],
      wash_package: ["basic", "premium", "deluxe"],
    },
  },
} as const
