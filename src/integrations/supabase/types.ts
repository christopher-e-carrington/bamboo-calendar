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
      custom_themes: {
        Row: {
          background_image_url: string | null
          card_opacity: number
          colors: Json
          created_at: string
          created_by: string
          household_id: string
          id: string
          name: string
          sidebar_color: string | null
          sidebar_opacity: number | null
        }
        Insert: {
          background_image_url?: string | null
          card_opacity?: number
          colors: Json
          created_at?: string
          created_by?: string
          household_id: string
          id?: string
          name: string
          sidebar_color?: string | null
          sidebar_opacity?: number | null
        }
        Update: {
          background_image_url?: string | null
          card_opacity?: number
          colors?: Json
          created_at?: string
          created_by?: string
          household_id?: string
          id?: string
          name?: string
          sidebar_color?: string | null
          sidebar_opacity?: number | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          details: string | null
          doc_date: string | null
          file_name: string | null
          file_path: string | null
          id: string
          mime_type: string | null
          name: string
          notes: string | null
          owner_id: string
          size_bytes: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          doc_date?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          mime_type?: string | null
          name: string
          notes?: string | null
          owner_id: string
          size_bytes?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          doc_date?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          mime_type?: string | null
          name?: string
          notes?: string | null
          owner_id?: string
          size_bytes?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      event_google_sync: {
        Row: {
          created_at: string
          direction: string
          event_id: string
          google_calendar_id: string
          google_event_id: string
          household_id: string
          last_synced_at: string
        }
        Insert: {
          created_at?: string
          direction: string
          event_id: string
          google_calendar_id: string
          google_event_id: string
          household_id: string
          last_synced_at?: string
        }
        Update: {
          created_at?: string
          direction?: string
          event_id?: string
          google_calendar_id?: string
          google_event_id?: string
          household_id?: string
          last_synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_google_sync_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_push_log: {
        Row: {
          at: string
          event_id: string
          kind: string
        }
        Insert: {
          at?: string
          event_id: string
          kind: string
        }
        Update: {
          at?: string
          event_id?: string
          kind?: string
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
      google_calendar_settings: {
        Row: {
          calendar_id: string
          created_at: string
          household_id: string
          sync_enabled: boolean
          updated_at: string
        }
        Insert: {
          calendar_id?: string
          created_at?: string
          household_id: string
          sync_enabled?: boolean
          updated_at?: string
        }
        Update: {
          calendar_id?: string
          created_at?: string
          household_id?: string
          sync_enabled?: boolean
          updated_at?: string
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
          profile_id: string | null
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
          profile_id?: string | null
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
          profile_id?: string | null
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_invitations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "household_profiles"
            referencedColumns: ["id"]
          },
        ]
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
          birthday: string | null
          claimed_user_id: string | null
          color: string
          created_at: string
          id: string
          initials: string
          name: string
          nickname: string | null
          owner_id: string
          pin: string | null
          role: string
          sort_order: number
        }
        Insert: {
          birthday?: string | null
          claimed_user_id?: string | null
          color?: string
          created_at?: string
          id?: string
          initials?: string
          name: string
          nickname?: string | null
          owner_id: string
          pin?: string | null
          role?: string
          sort_order?: number
        }
        Update: {
          birthday?: string | null
          claimed_user_id?: string | null
          color?: string
          created_at?: string
          id?: string
          initials?: string
          name?: string
          nickname?: string | null
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
      journal_entries: {
        Row: {
          content: string
          created_at: string
          entry_date: string
          id: string
          is_favorite: boolean
          location: string | null
          mood: string | null
          owner_id: string
          profile_id: string | null
          tags: string[]
          title: string | null
          updated_at: string
          weather: string | null
        }
        Insert: {
          content?: string
          created_at?: string
          entry_date?: string
          id?: string
          is_favorite?: boolean
          location?: string | null
          mood?: string | null
          owner_id: string
          profile_id?: string | null
          tags?: string[]
          title?: string | null
          updated_at?: string
          weather?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          entry_date?: string
          id?: string
          is_favorite?: boolean
          location?: string | null
          mood?: string | null
          owner_id?: string
          profile_id?: string | null
          tags?: string[]
          title?: string | null
          updated_at?: string
          weather?: string | null
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
      notes: {
        Row: {
          content: string
          created_at: string
          id: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      passwords: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          owner_id: string
          password: string | null
          site_name: string
          updated_at: string
          url: string | null
          username: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          owner_id: string
          password?: string | null
          site_name: string
          updated_at?: string
          url?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          owner_id?: string
          password?: string | null
          site_name?: string
          updated_at?: string
          url?: string | null
          username?: string | null
        }
        Relationships: []
      }
      profile_event_google_sync: {
        Row: {
          created_at: string
          direction: string
          event_id: string
          google_calendar_id: string
          google_event_id: string
          household_id: string
          id: string
          last_synced_at: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          direction?: string
          event_id: string
          google_calendar_id: string
          google_event_id: string
          household_id: string
          id?: string
          last_synced_at?: string
          profile_id: string
        }
        Update: {
          created_at?: string
          direction?: string
          event_id?: string
          google_calendar_id?: string
          google_event_id?: string
          household_id?: string
          id?: string
          last_synced_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_event_google_sync_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_event_google_sync_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "household_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_google_tokens: {
        Row: {
          access_token: string
          calendar_id: string
          created_at: string
          google_email: string | null
          household_id: string
          id: string
          profile_id: string
          refresh_token: string
          scope: string | null
          sync_enabled: boolean
          token_expires_at: string
          updated_at: string
        }
        Insert: {
          access_token: string
          calendar_id?: string
          created_at?: string
          google_email?: string | null
          household_id: string
          id?: string
          profile_id: string
          refresh_token: string
          scope?: string | null
          sync_enabled?: boolean
          token_expires_at: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          calendar_id?: string
          created_at?: string
          google_email?: string | null
          household_id?: string
          id?: string
          profile_id?: string
          refresh_token?: string
          scope?: string | null
          sync_enabled?: boolean
          token_expires_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_google_tokens_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "household_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_steps: {
        Row: {
          completed_at: string | null
          created_at: string
          done: boolean
          due_date: string | null
          id: string
          project_id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          project_id: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          project_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_steps_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          color: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          owner_id: string
          profile_id: string | null
          sort_order: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          owner_id: string
          profile_id?: string | null
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          owner_id?: string
          profile_id?: string | null
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "household_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_outbox: {
        Row: {
          actor_user_id: string | null
          body: string
          created_at: string
          household_id: string
          id: string
          sent_at: string | null
          tag: string | null
          title: string
        }
        Insert: {
          actor_user_id?: string | null
          body: string
          created_at?: string
          household_id: string
          id?: string
          sent_at?: string | null
          tag?: string | null
          title?: string
        }
        Update: {
          actor_user_id?: string | null
          body?: string
          created_at?: string
          household_id?: string
          id?: string
          sent_at?: string | null
          tag?: string | null
          title?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          household_id: string
          id: string
          label: string | null
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          household_id: string
          id?: string
          label?: string | null
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          household_id?: string
          id?: string
          label?: string | null
          p256dh?: string
          updated_at?: string
          user_id?: string
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
      reminders: {
        Row: {
          channels: string[]
          created_at: string
          created_by: string
          delivery_status: Json | null
          id: string
          message: string
          owner_id: string
          pushed_at: string | null
          recipient_profile_ids: string[]
          recurrence: string
          send_at: string
          sent_at: string | null
          updated_at: string
        }
        Insert: {
          channels?: string[]
          created_at?: string
          created_by: string
          delivery_status?: Json | null
          id?: string
          message: string
          owner_id: string
          pushed_at?: string | null
          recipient_profile_ids?: string[]
          recurrence?: string
          send_at: string
          sent_at?: string | null
          updated_at?: string
        }
        Update: {
          channels?: string[]
          created_at?: string
          created_by?: string
          delivery_status?: Json | null
          id?: string
          message?: string
          owner_id?: string
          pushed_at?: string | null
          recipient_profile_ids?: string[]
          recurrence?: string
          send_at?: string
          sent_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      routines: {
        Row: {
          created_at: string
          id: string
          items: Json
          loaded_at: string | null
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
          loaded_at?: string | null
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
          loaded_at?: string | null
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
          store_id: string | null
        }
        Insert: {
          created_at?: string
          done?: boolean
          id?: string
          name: string
          owner_id: string
          quantity?: string | null
          source?: string
          store_id?: string | null
        }
        Update: {
          created_at?: string
          done?: boolean
          id?: string
          name?: string
          owner_id?: string
          quantity?: string | null
          source?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopping_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "shopping_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_stores: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          entitlement: string | null
          environment: string
          id: string
          platform: string
          price_id: string | null
          product_id: string | null
          revenuecat_app_user_id: string | null
          source: string
          status: string
          store_transaction_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          entitlement?: string | null
          environment?: string
          id?: string
          platform?: string
          price_id?: string | null
          product_id?: string | null
          revenuecat_app_user_id?: string | null
          source?: string
          status?: string
          store_transaction_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          entitlement?: string | null
          environment?: string
          id?: string
          platform?: string
          price_id?: string | null
          product_id?: string | null
          revenuecat_app_user_id?: string | null
          source?: string
          status?: string
          store_transaction_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed_at: string | null
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
          completed_at?: string | null
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
          completed_at?: string | null
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
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
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
          profile_id: string
          profile_name: string
          status: string
        }[]
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      household_is_premium: {
        Args: { _env?: string; _household: string }
        Returns: boolean
      }
      is_household_member: {
        Args: { _household: string; _user: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
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
