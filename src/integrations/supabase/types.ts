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
          slot_number: number | null
          scheduled_at: string
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
          slot_number?: number | null
          scheduled_at: string
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
          slot_number?: number | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          user_id?: string
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
          surname: string | null
          updated_at: string
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
          surname?: string | null
          updated_at?: string
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
          surname?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          id: string
          items: Json
          status: string
          total_amount: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          items: Json
          status: string
          total_amount: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          status?: string
          total_amount?: number
          user_id?: string | null
        }
        Relationships: []
      }
      sent_notifications: {
        Row: {
          booking_id: string | null
          channel: string
          id: string
          message: string | null
          sent_at: string
          title: string | null
          type: string
          user_id: string
        }
        Insert: {
          booking_id?: string | null
          channel: string
          id?: string
          message?: string | null
          sent_at?: string
          title?: string | null
          type: string
          user_id: string
        }
        Update: {
          booking_id?: string | null
          channel?: string
          id?: string
          message?: string | null
          sent_at?: string
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
      employee_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          booking_id: string
          completed_at: string | null
          employee_id: string
          id: string
          status: Database["public"]["Enums"]["employee_assignment_status"]
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          booking_id: string
          completed_at?: string | null
          employee_id: string
          id?: string
          status?: Database["public"]["Enums"]["employee_assignment_status"]
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          booking_id?: string
          completed_at?: string | null
          employee_id?: string
          id?: string
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
      complete_employee_assignment: {
        Args: { _assignment_id: string }
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "employee" | "user"
      employee_assignment_status: "active" | "completed"
      booking_status:
        | "pending"
        | "confirmed"
        | "in_queue"
        | "in_progress"
        | "completed"
        | "cancelled"
      payment_status: "unpaid" | "paid" | "free"
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
      app_role: ["admin", "employee", "user"],
      employee_assignment_status: ["active", "completed"],
      booking_status: [
        "pending",
        "confirmed",
        "in_queue",
        "in_progress",
        "completed",
        "cancelled",
      ],
      payment_status: ["unpaid", "paid", "free"],
      wash_package: ["basic", "premium", "deluxe"],
    },
  },
} as const
