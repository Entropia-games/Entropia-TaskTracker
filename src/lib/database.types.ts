export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          display_name: string | null
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          name?: string | null
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
        }
        Relationships: []
      }
      boards: {
        Row: {
          id: string
          name: string
          data: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id: string
          name?: string
          data?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          data?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: number
          name: string
          code: string
          created_at: string
        }
        Insert: {
          id?: number
          name: string
          code: string
          created_at?: string
        }
        Update: {
          id?: number
          name?: string
          code?: string
          created_at?: string
        }
        Relationships: []
      }
      issues: {
        Row: {
          id: number
          title: string
          description: string | null
          status: Database["public"]["Enums"]["issue_status"]
          priority: Database["public"]["Enums"]["issue_priority"]
          team: Database["public"]["Enums"]["issue_team"] | null
          is_epic: boolean
          parent_epic_id: number | null
          milestone_id: number | null
          due_date: string | null
          assignee_id: string | null
          created_by: string | null
          project_id: number | null
          display_id: number | null
          attachments: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          title: string
          description?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          priority?: Database["public"]["Enums"]["issue_priority"]
          team?: Database["public"]["Enums"]["issue_team"] | null
          is_epic?: boolean
          parent_epic_id?: number | null
          milestone_id?: number | null
          due_date?: string | null
          assignee_id?: string | null
          created_by?: string | null
          project_id?: number | null
          display_id?: number | null
          attachments?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          title?: string
          description?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          priority?: Database["public"]["Enums"]["issue_priority"]
          team?: Database["public"]["Enums"]["issue_team"] | null
          is_epic?: boolean
          parent_epic_id?: number | null
          milestone_id?: number | null
          due_date?: string | null
          assignee_id?: string | null
          created_by?: string | null
          project_id?: number | null
          display_id?: number | null
          attachments?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      issue_links: {
        Row: {
          id: number
          issue_id: number
          pr_url: string
          pr_title: string
          pr_state: string
          created_at: string
        }
        Insert: {
          id?: number
          issue_id: number
          pr_url: string
          pr_title: string
          pr_state?: string
          created_at?: string
        }
        Update: {
          id?: number
          issue_id?: number
          pr_url?: string
          pr_title?: string
          pr_state?: string
          created_at?: string
        }
        Relationships: []
      }
      milestones: {
        Row: {
          id: number
          name: string
          description: string | null
          target_date: string | null
          project_id: number | null
          created_at: string
        }
        Insert: {
          id?: number
          name: string
          description?: string | null
          target_date?: string | null
          project_id?: number | null
          created_at?: string
        }
        Update: {
          id?: number
          name?: string
          description?: string | null
          target_date?: string | null
          project_id?: number | null
          created_at?: string
        }
        Relationships: []
      }
      timeline_entries: {
        Row: {
          id: number
          project_id: number
          issue_id: number
          start_date: string
          end_date: string
          color: string | null
          position: number
          created_at: string
        }
        Insert: {
          id?: number
          project_id: number
          issue_id: number
          start_date: string
          end_date: string
          color?: string | null
          position?: number
          created_at?: string
        }
        Update: {
          id?: number
          project_id?: number
          issue_id?: number
          start_date?: string
          end_date?: string
          color?: string | null
          position?: number
          created_at?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          id: number
          user_id: string
          project_id: number
          role: string
          name: string | null
          created_at: string
        }
        Insert: {
          id?: number
          user_id: string
          project_id: number
          role?: string
          name?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          project_id?: number
          role?: string
          name?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      get_email_by_nickname: {
        Args: { nickname: string }
        Returns: string
      }
    }
    Enums: {
      issue_status: "backlog" | "todo" | "in_progress" | "done" | "canceled"
      issue_priority: "none" | "low" | "medium" | "high" | "urgent"
      issue_team: "3D" | "Concept" | "DEV" | "QA" | "GD" | "Sound" | "LD"
    }
    CompositeTypes: Record<string, never>
  }
}
