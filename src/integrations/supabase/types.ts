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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      bitrix_pipelines: {
        Row: {
          created_at: string
          id: string
          name: string
          sort: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          sort?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      bitrix_stage_map: {
        Row: {
          created_at: string
          funnel_step: string
          label: string | null
          stage_id: string
          step_rank: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          funnel_step: string
          label?: string | null
          stage_id: string
          step_rank?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          funnel_step?: string
          label?: string | null
          stage_id?: string
          step_rank?: number
          updated_at?: string
        }
        Relationships: []
      }
      bitrix_stages: {
        Row: {
          created_at: string
          name: string
          pipeline_id: string
          semantics: string | null
          sort: number
          stage_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          name: string
          pipeline_id: string
          semantics?: string | null
          sort?: number
          stage_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          name?: string
          pipeline_id?: string
          semantics?: string | null
          sort?: number
          stage_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      campaign_lead_map: {
        Row: {
          campaign_id: string
          created_at: string
          label: string
          note: string | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          label: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          label?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      google_ads_campaign_daily: {
        Row: {
          campaign_id: string
          campaign_name: string | null
          clicks: number
          conversions: number
          cost: number
          date: string
          impressions: number
          status: string | null
          synced_at: string
        }
        Insert: {
          campaign_id: string
          campaign_name?: string | null
          clicks?: number
          conversions?: number
          cost?: number
          date: string
          impressions?: number
          status?: string | null
          synced_at?: string
        }
        Update: {
          campaign_id?: string
          campaign_name?: string | null
          clicks?: number
          conversions?: number
          cost?: number
          date?: string
          impressions?: number
          status?: string | null
          synced_at?: string
        }
        Relationships: []
      }
      lead_goals: {
        Row: {
          created_at: string
          id: string
          match_terms: string[]
          meta_leads: number
          month: number
          operadora: string
          sort_order: number
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          match_terms?: string[]
          meta_leads?: number
          month: number
          operadora: string
          sort_order?: number
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          match_terms?: string[]
          meta_leads?: number
          month?: number
          operadora?: string
          sort_order?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      lead_match: {
        Row: {
          ad_id: string | null
          adset_id: string | null
          bitrix_deal_id: string
          campaign_id: string | null
          campaign_name: string | null
          match_source: string
          matched_at: string
          meta_lead_id: string | null
        }
        Insert: {
          ad_id?: string | null
          adset_id?: string | null
          bitrix_deal_id: string
          campaign_id?: string | null
          campaign_name?: string | null
          match_source: string
          matched_at?: string
          meta_lead_id?: string | null
        }
        Update: {
          ad_id?: string | null
          adset_id?: string | null
          bitrix_deal_id?: string
          campaign_id?: string | null
          campaign_name?: string | null
          match_source?: string
          matched_at?: string
          meta_lead_id?: string | null
        }
        Relationships: []
      }
      meta_ad_insights: {
        Row: {
          account_id: string
          actions: Json | null
          ad_id: string
          adset_id: string | null
          campaign_id: string | null
          clicks: number | null
          cpc: number | null
          cpm: number | null
          ctr: number | null
          date_start: string
          frequency: number | null
          impressions: number | null
          inline_link_clicks: number | null
          reach: number | null
          spend: number | null
          synced_at: string
        }
        Insert: {
          account_id: string
          actions?: Json | null
          ad_id: string
          adset_id?: string | null
          campaign_id?: string | null
          clicks?: number | null
          cpc?: number | null
          cpm?: number | null
          ctr?: number | null
          date_start: string
          frequency?: number | null
          impressions?: number | null
          inline_link_clicks?: number | null
          reach?: number | null
          spend?: number | null
          synced_at?: string
        }
        Update: {
          account_id?: string
          actions?: Json | null
          ad_id?: string
          adset_id?: string | null
          campaign_id?: string | null
          clicks?: number | null
          cpc?: number | null
          cpm?: number | null
          ctr?: number | null
          date_start?: string
          frequency?: number | null
          impressions?: number | null
          inline_link_clicks?: number | null
          reach?: number | null
          spend?: number | null
          synced_at?: string
        }
        Relationships: []
      }
      meta_ads: {
        Row: {
          account_id: string
          adset_id: string
          campaign_id: string
          created_time: string | null
          creative_id: string | null
          effective_status: string | null
          id: string
          name: string | null
          status: string | null
          synced_at: string
          updated_time: string | null
        }
        Insert: {
          account_id: string
          adset_id: string
          campaign_id: string
          created_time?: string | null
          creative_id?: string | null
          effective_status?: string | null
          id: string
          name?: string | null
          status?: string | null
          synced_at?: string
          updated_time?: string | null
        }
        Update: {
          account_id?: string
          adset_id?: string
          campaign_id?: string
          created_time?: string | null
          creative_id?: string | null
          effective_status?: string | null
          id?: string
          name?: string | null
          status?: string | null
          synced_at?: string
          updated_time?: string | null
        }
        Relationships: []
      }
      meta_adsets: {
        Row: {
          account_id: string
          billing_event: string | null
          campaign_id: string
          created_time: string | null
          daily_budget: number | null
          effective_status: string | null
          id: string
          lifetime_budget: number | null
          name: string | null
          optimization_goal: string | null
          status: string | null
          synced_at: string
          updated_time: string | null
        }
        Insert: {
          account_id: string
          billing_event?: string | null
          campaign_id: string
          created_time?: string | null
          daily_budget?: number | null
          effective_status?: string | null
          id: string
          lifetime_budget?: number | null
          name?: string | null
          optimization_goal?: string | null
          status?: string | null
          synced_at?: string
          updated_time?: string | null
        }
        Update: {
          account_id?: string
          billing_event?: string | null
          campaign_id?: string
          created_time?: string | null
          daily_budget?: number | null
          effective_status?: string | null
          id?: string
          lifetime_budget?: number | null
          name?: string | null
          optimization_goal?: string | null
          status?: string | null
          synced_at?: string
          updated_time?: string | null
        }
        Relationships: []
      }
      meta_campaigns: {
        Row: {
          account_id: string
          created_time: string | null
          daily_budget: number | null
          effective_status: string | null
          id: string
          lifetime_budget: number | null
          name: string | null
          objective: string | null
          start_time: string | null
          status: string | null
          stop_time: string | null
          synced_at: string
          updated_time: string | null
        }
        Insert: {
          account_id: string
          created_time?: string | null
          daily_budget?: number | null
          effective_status?: string | null
          id: string
          lifetime_budget?: number | null
          name?: string | null
          objective?: string | null
          start_time?: string | null
          status?: string | null
          stop_time?: string | null
          synced_at?: string
          updated_time?: string | null
        }
        Update: {
          account_id?: string
          created_time?: string | null
          daily_budget?: number | null
          effective_status?: string | null
          id?: string
          lifetime_budget?: number | null
          name?: string | null
          objective?: string | null
          start_time?: string | null
          status?: string | null
          stop_time?: string | null
          synced_at?: string
          updated_time?: string | null
        }
        Relationships: []
      }
      meta_lead_form_map: {
        Row: {
          campaign_id: string
          created_at: string
          form_label: string
          note: string | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          form_label: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          form_label?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      meta_lead_forms: {
        Row: {
          created_at: string
          id: string
          leads_count: number | null
          name: string | null
          page_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          leads_count?: number | null
          name?: string | null
          page_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          leads_count?: number | null
          name?: string | null
          page_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      meta_leads: {
        Row: {
          ad_id: string | null
          ad_name: string | null
          adset_id: string | null
          adset_name: string | null
          campaign_id: string | null
          campaign_name: string | null
          cidade: string | null
          created_time: string | null
          email: string | null
          form_id: string | null
          form_name: string | null
          lead_id: string
          nome: string | null
          respostas: Json | null
          synced_at: string
          telefone_norm: string | null
          telefone_raw: string | null
        }
        Insert: {
          ad_id?: string | null
          ad_name?: string | null
          adset_id?: string | null
          adset_name?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          cidade?: string | null
          created_time?: string | null
          email?: string | null
          form_id?: string | null
          form_name?: string | null
          lead_id: string
          nome?: string | null
          respostas?: Json | null
          synced_at?: string
          telefone_norm?: string | null
          telefone_raw?: string | null
        }
        Update: {
          ad_id?: string | null
          ad_name?: string | null
          adset_id?: string | null
          adset_name?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          cidade?: string | null
          created_time?: string | null
          email?: string | null
          form_id?: string | null
          form_name?: string | null
          lead_id?: string
          nome?: string | null
          respostas?: Json | null
          synced_at?: string
          telefone_norm?: string | null
          telefone_raw?: string | null
        }
        Relationships: []
      }
      meta_sync_state: {
        Row: {
          key: string
          last_run: string | null
          last_status: string | null
          meta: Json | null
        }
        Insert: {
          key: string
          last_run?: string | null
          last_status?: string | null
          meta?: Json | null
        }
        Update: {
          key?: string
          last_run?: string | null
          last_status?: string | null
          meta?: Json | null
        }
        Relationships: []
      }
      private_settings: {
        Row: {
          k: string
          v: string | null
        }
        Insert: {
          k: string
          v?: string | null
        }
        Update: {
          k?: string
          v?: string | null
        }
        Relationships: []
      }
      sync_state: {
        Row: {
          key: string
          last_run: string | null
          last_status: string | null
          start_cursor: number
        }
        Insert: {
          key: string
          last_run?: string | null
          last_status?: string | null
          start_cursor?: number
        }
        Update: {
          key?: string
          last_run?: string | null
          last_status?: string | null
          start_cursor?: number
        }
        Relationships: []
      }
      utm_conversions: {
        Row: {
          ad_id: string | null
          ad_id_meta: string | null
          ad_name: string | null
          adset_id: string | null
          adset_id_meta: string | null
          adset_name: string | null
          bitrix_deal_id: string
          campaign_id: string | null
          campaign_name: string | null
          campaign_name_meta: string | null
          contato_email: string | null
          contato_nome: string | null
          contato_telefone: string | null
          contato_telefone_norm: string | null
          data_criacao: string | null
          dominio: string | null
          fase: string | null
          fbclid: string | null
          id: string
          id_formulario: string | null
          nome_formulario: string | null
          origem: string | null
          placement: string | null
          site_source_name: string | null
          synced_at: string
          titulo: string | null
          url_pagina: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          valor: number | null
        }
        Insert: {
          ad_id?: string | null
          ad_id_meta?: string | null
          ad_name?: string | null
          adset_id?: string | null
          adset_id_meta?: string | null
          adset_name?: string | null
          bitrix_deal_id: string
          campaign_id?: string | null
          campaign_name?: string | null
          campaign_name_meta?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          contato_telefone_norm?: string | null
          data_criacao?: string | null
          dominio?: string | null
          fase?: string | null
          fbclid?: string | null
          id?: string
          id_formulario?: string | null
          nome_formulario?: string | null
          origem?: string | null
          placement?: string | null
          site_source_name?: string | null
          synced_at?: string
          titulo?: string | null
          url_pagina?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          valor?: number | null
        }
        Update: {
          ad_id?: string | null
          ad_id_meta?: string | null
          ad_name?: string | null
          adset_id?: string | null
          adset_id_meta?: string | null
          adset_name?: string | null
          bitrix_deal_id?: string
          campaign_id?: string | null
          campaign_name?: string | null
          campaign_name_meta?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          contato_telefone_norm?: string | null
          data_criacao?: string | null
          dominio?: string | null
          fase?: string | null
          fbclid?: string | null
          id?: string
          id_formulario?: string | null
          nome_formulario?: string | null
          origem?: string | null
          placement?: string | null
          site_source_name?: string | null
          synced_at?: string
          titulo?: string | null
          url_pagina?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          valor?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      extract_form_keyword: { Args: { _label: string }; Returns: string }
      get_bitrix_pipeline_funnel: {
        Args: { p_from: string; p_origem?: string[]; p_to: string }
        Returns: Json
      }
      get_bitrix_stage_leads: {
        Args: {
          p_from: string
          p_origem?: string[]
          p_stage_id: string
          p_to: string
        }
        Returns: Json
      }
      get_campaign_crm_funnel: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      get_campaign_crm_leads: {
        Args: { p_campaign_id: string; p_from: string; p_to: string }
        Returns: Json
      }
      get_google_detail: {
        Args: {
          p_dominio?: string[]
          p_from: string
          p_to: string
          p_utm_campaign?: string[]
          p_utm_source?: string[]
        }
        Returns: Json
      }
      get_meta_detail: {
        Args: {
          p_dominio?: string[]
          p_from: string
          p_to: string
          p_utm_campaign?: string[]
          p_utm_source?: string[]
        }
        Returns: Json
      }
      get_meta_performance: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      get_stage_mapping: {
        Args: { p_from: string; p_origem?: string[]; p_to: string }
        Returns: Json
      }
      get_utm_dashboard_stats: {
        Args: {
          p_dominio?: string[]
          p_from: string
          p_origem?: string[]
          p_to: string
          p_utm_campaign?: string[]
          p_utm_source?: string[]
        }
        Returns: Json
      }
      is_trive_meta_lead: {
        Args: { _ad_id: string; _campaign_name: string }
        Returns: boolean
      }
      list_unmapped_form_labels: {
        Args: never
        Returns: {
          form_label: string
          leads: number
          match_source: string
          suggested_campaign_id: string
          suggested_campaign_name: string
          ultimo: string
        }[]
      }
      norm_phone: { Args: { _v: string }; Returns: string }
      rebuild_lead_match: { Args: never; Returns: Json }
      resolve_form_label_to_campaign: {
        Args: { _label: string }
        Returns: {
          campaign_id: string
          source: string
        }[]
      }
      resolved_campaign_leads: {
        Args: { p_from: string; p_to: string }
        Returns: {
          bitrix_deal_id: string
          campaign_id: string
          campaign_name: string
          cidade: string
          data_criacao: string
          fase: string
          funnel_step: string
          match_source: string
          stage_label: string
          step_rank: number
          telefone: string
          titulo: string
          valor: number
        }[]
      }
      unaccent: { Args: { "": string }; Returns: string }
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
  public: {
    Enums: {},
  },
} as const
