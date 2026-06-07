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
      contacts: {
        Row: {
          address: string | null
          birthday: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          owner_id: string
          phone: string | null
        }
        Insert: {
          address?: string | null
          birthday?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_id: string
          phone?: string | null
        }
        Update: {
          address?: string | null
          birthday?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          contact_id: string | null
          created_at: string
          end_at: string | null
          id: string
          location: string | null
          notes: string | null
          owner_id: string
          profile_id: string
          profile_ids: string[]
          recurrence: string
          start_at: string
          title: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          end_at?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          owner_id: string
          profile_id: string
          profile_ids?: string[]
          recurrence?: string
          start_at: string
          title: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          end_at?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          owner_id?: string
          profile_id?: string
          profile_ids?: string[]
          recurrence?: string
          start_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "household_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          done: boolean
          id: string
          notes: string | null
          owner_id: string
          profile_id: string
          progress: number
          target: number
          tier: string
          title: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          id?: string
          notes?: string | null
          owner_id: string
          profile_id: string
          progress?: number
          target?: number
          tier?: string
          title: string
        }
        Update: {
          created_at?: string
          done?: boolean
          id?: string
          notes?: string | null
          owner_id?: string
          profile_id?: string
          progress?: number
          target?: number
          tier?: string
          title?: string
        }
        Relationships: []
      }
      household_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          expires_at: string
          household_id: string
          id: string
          invited_email: string | null
          invited_name: string | null
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          expires_at?: string
          household_id: string
          id?: string
          invited_email?: string | null
          invited_name?: string | null
          status?: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          expires_at?: string
          household_id?: string
          id?: string
          invited_email?: string | null
          invited_name?: string | null
          status?: string
          token?: string
        }
        Relationships: []
      }
      household_members: {
        Row: {
          created_at: string
          display_name: string | null
          household_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          household_id: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          household_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      household_profiles: {
        Row: {
          color: string
          created_at: string
          id: string
          initials: string
          name: string
          owner_id: string
          pin: string | null
          role: string
          sort_order: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          initials?: string
          name: string
          owner_id: string
          pin?: string | null
          role?: string
          sort_order?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          initials?: string
          name?: string
          owner_id?: string
          pin?: string | null
          role?: string
          sort_order?: number
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          category: string | null
          created_at: string
          id: string
          low_stock: boolean
          name: string
          owner_id: string
          quantity: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          low_stock?: boolean
          name: string
          owner_id: string
          quantity?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          low_stock?: boolean
          name?: string
          owner_id?: string
          quantity?: string | null
        }
        Relationships: []
      }
      meal_plan: {
        Row: {
          created_at: string
          day_of_week: number
          event_id: string | null
          id: string
          meal_type: string
          owner_id: string
          recipe_id: string | null
          recipe_name: string
          show_on_calendar: boolean
          week_start: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          event_id?: string | null
          id?: string
          meal_type: string
          owner_id: string
          recipe_id?: string | null
          recipe_name: string
          show_on_calendar?: boolean
          week_start: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          event_id?: string | null
          id?: string
          meal_type?: string
          owner_id?: string
          recipe_id?: string | null
          recipe_name?: string
          show_on_calendar?: boolean
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      memories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          location: string | null
          memory_date: string
          memory_time: string | null
          owner_id: string
          photo_url: string | null
          profile_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          memory_date: string
          memory_time?: string | null
          owner_id: string
          photo_url?: string | null
          profile_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          memory_date?: string
          memory_time?: string | null
          owner_id?: string
          photo_url?: string | null
          profile_id?: string | null
          title?: string
        }
        Relationships: []
      }
      recipes: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          ingredients: string[]
          instructions: string | null
          name: string
          owner_id: string
          prep_time: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          ingredients?: string[]
          instructions?: string | null
          name: string
          owner_id: string
          prep_time?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          ingredients?: string[]
          instructions?: string | null
          name?: string
          owner_id?: string
          prep_time?: number | null
        }
        Relationships: []
      }
      routines: {
        Row: {
          created_at: string
          id: string
          items: Json
          name: string
          notes: string | null
          owner_id: string
          profile_id: string
          recurrence: string
          tier: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json
          name: string
          notes?: string | null
          owner_id: string
          profile_id: string
          recurrence?: string
          tier?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          name?: string
          notes?: string | null
          owner_id?: string
          profile_id?: string
          recurrence?: string
          tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routines_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "household_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_items: {
        Row: {
          created_at: string
          done: boolean
          id: string
          name: string
          owner_id: string
          quantity: string | null
          source: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          id?: string
          name: string
          owner_id: string
          quantity?: string | null
          source?: string
        }
        Update: {
          created_at?: string
          done?: boolean
          id?: string
          name?: string
          owner_id?: string
          quantity?: string | null
          source?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          created_at: string
          done: boolean
          due_at: string | null
          id: string
          owner_id: string
          profile_id: string
          recurrence: string
          tier: string
          title: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          due_at?: string | null
          id?: string
          owner_id: string
          profile_id: string
          recurrence?: string
          tier?: string
          title: string
        }
        Update: {
          created_at?: string
          done?: boolean
          due_at?: string | null
          id?: string
          owner_id?: string
          profile_id?: string
          recurrence?: string
          tier?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "household_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: {
        Args: {
          _address?: string
          _birthday?: string
          _email?: string
          _name: string
          _phone?: string
          _token: string
        }
        Returns: string
      }
      get_invitation_by_token: {
        Args: { _token: string }
        Returns: {
          expires_at: string
          household_id: string
          household_name: string
          id: string
          invited_email: string
          invited_name: string
          status: string
        }[]
      }
      is_household_member: {
        Args: { _household: string; _user: string }
        Returns: boolean
      }
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
    Enums: {},
  },
} as const
