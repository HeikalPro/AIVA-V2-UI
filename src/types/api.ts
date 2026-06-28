export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type UserProfile = {
  id: number;
  email: string;
  organization_id: number;
  first_name: string | null;
  last_name: string | null;
  roles: string[];
};

export type Organization = {
  id: number;
  name: string;
  code: string;
  status: string;
  account_count?: number;
  account_names?: string[];
  created_at?: string | null;
  updated_at?: string | null;
};

export type OrganizationCreate = {
  name: string;
  code: string;
  status?: string;
};

export type OrganizationUpdate = {
  name?: string;
  status?: string;
};

export type OrganizationDeleteSummary = {
  organization_id: number;
  name: string;
  code: string;
  user_count: number;
  account_count: number;
  ticket_count: number;
  account_names: string[];
};

export type OrganizationDeleteResult = {
  message: string;
  accounts_deleted: number;
  users_deleted: number;
  tickets_deleted: number;
};

export type CorpusSummary = {
  corpus_id: string;
  name: string;
  slug: string;
};

export type Account = {
  id: number;
  organization_id: number;
  organization_name?: string | null;
  organization_code?: string | null;
  llm_config_id: number | null;
  name: string;
  description: string | null;
  corpus_id: string | null;
  status: string;
  /** URL template for KB source links; append ID or use {id}. Falls back to server default if empty. */
  kb_source_base_url?: string | null;
  created_at?: string | null;
};

export type AccountCreate = {
  organization_id: number;
  name: string;
  description?: string | null;
  corpus_id?: string | null;
  llm_config_id?: number | null;
  status?: string;
  kb_source_base_url?: string | null;
};

export type AccountUpdate = {
  name?: string;
  description?: string | null;
  corpus_id?: string | null;
  llm_config_id?: number | null;
  status?: string;
  kb_source_base_url?: string | null;
};

export type User = {
  id: number;
  organization_id: number;
  organization_name?: string | null;
  organization_code?: string | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: string;
  roles: string[];
  account_ids: number[];
  created_at?: string | null;
};

export type UserCreate = {
  organization_id: number;
  email: string;
  password: string;
  first_name?: string | null;
  last_name?: string | null;
  status?: string;
  role_id: number;
  account_id?: number | null;
};

export type UserUpdate = {
  organization_id?: number;
  email?: string;
  password?: string;
  first_name?: string | null;
  last_name?: string | null;
  status?: string;
  role_id?: number;
};

export type UserRoleAssign = {
  role_id: number;
  account_id?: number | null;
};

export type AccountUserAssign = {
  account_id: number;
  status?: string;
};

export type Prompt = {
  id: number;
  account_id: number;
  prompt_name: string;
  prompt_type: string | null;
  prompt_text: string;
  version_number: number;
  is_active: boolean;
  created_by: number | null;
  created_at?: string | null;
};

export type PromptCreate = {
  account_id: number;
  prompt_name: string;
  prompt_type?: string | null;
  prompt_text: string;
  is_active?: boolean;
};

export type PromptUpdate = {
  prompt_name?: string;
  prompt_type?: string | null;
  prompt_text?: string;
  is_active?: boolean;
};

export type SystemPrompt = {
  prompt_text: string;
  updated_at?: string | null;
};

export type SystemPromptUpdate = {
  prompt_text: string;
};

export type ChatSession = {
  id: number;
  account_id: number;
  user_id: number;
  agent_first_name?: string | null;
  agent_last_name?: string | null;
  agent_email?: string | null;
  session_status: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  message_count?: number | null;
};

export type KbSource = {
  parent_id: string;
  url: string;
};

export type ChatMessage = {
  id: number;
  session_id: number;
  sender_type: string;
  message_text: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  latency_ms: number | null;
  created_at?: string | null;
  rating?: "up" | "down" | null;
  feedback?: string | null;
  rated_at?: string | null;
  sources?: KbSource[];
};

export type MessageRating = {
  message_id: number;
  session_id: number;
  account_id: number;
  account_name: string | null;
  organization_id: number;
  organization_name: string | null;
  agent_user_id: number;
  agent_email: string | null;
  agent_first_name: string | null;
  agent_last_name: string | null;
  message_text: string;
  rating: "up" | "down";
  feedback: string | null;
  rated_at: string | null;
};

export type Ticket = {
  id: number;
  organization_id: number;
  account_id: number | null;
  created_by: number;
  assigned_to: number | null;
  ticket_type: string | null;
  status: string | null;
  subject: string | null;
  description: string | null;
  created_at?: string | null;
};

export type DeveloperNotify = {
  status: "disabled" | "no_recipients" | "sent" | "failed";
  message: string;
  recipients?: string[];
};

export type TicketCreate = {
  organization_id: number;
  account_id?: number | null;
  ticket_type: string;
  subject: string;
  description: string;
};

export type TicketCreateResponse = Ticket & {
  developer_notify: DeveloperNotify;
};

export type TicketUpdate = {
  assigned_to?: number | null;
  ticket_type?: string;
  status?: string;
  subject?: string;
  description?: string;
};

export type AccountAnnouncement = {
  id: number;
  account_id: number;
  account_name?: string | null;
  organization_id?: number | null;
  organization_name?: string | null;
  title: string;
  body: string;
  is_active: boolean;
  created_by: number;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AccountAnnouncementCreate = {
  account_id: number;
  title: string;
  body: string;
  is_active?: boolean;
};

export type AccountAnnouncementUpdate = {
  title?: string;
  body?: string;
  is_active?: boolean;
};

export type IngestionRequest = {
  id: number;
  account_id: number;
  account_name?: string | null;
  organization_id?: number | null;
  organization_name?: string | null;
  requested_by: number;
  requester_name?: string | null;
  requester_email?: string | null;
  requester_phone?: string | null;
  request_type: string | null;
  status: string | null;
  priority: string | null;
  description: string | null;
  created_at?: string | null;
};

export type IngestionRequestCreate = {
  account_id: number;
  request_type: string;
  description: string;
  requester_phone: string;
};

export type IngestionRequestCreateResponse = IngestionRequest & {
  developer_notify: DeveloperNotify;
};

export type IngestionRequestUpdate = {
  status: string;
};

export type IngestionTrigger = {
  corpus_id: string;
  lines?: string[];
  records?: Record<string, unknown>[];
  reindex?: boolean;
};

export type JobOut = {
  job_id: string;
  mode?: string | null;
  status?: string | null;
  error_msg?: string | null;
};

export type DashboardStats = {
  total_sessions: number;
  total_messages: number;
  total_ai_requests: number;
  avg_response_time_ms: number | null;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost: number | null;
};

export type AgentMetric = {
  user_id: number;
  account_id: number;
  agent_first_name?: string | null;
  agent_last_name?: string | null;
  agent_email?: string | null;
  avg_response_time: number | null;
  ai_usage_count: number | null;
  successful_answers: number | null;
  escalation_count: number | null;
  calculated_at?: string | null;
};

export type LLMConfig = {
  id: number;
  provider: string;
  model_name: string;
  api_base_url: string | null;
  temperature: number | null;
  max_tokens: number | null;
  embedding_model: string | null;
  reranker_model: string | null;
  is_active: boolean;
  created_at?: string | null;
};

export type LLMConfigCreate = {
  provider: string;
  model_name: string;
  api_base_url?: string | null;
  temperature?: number | null;
  max_tokens?: number | null;
  embedding_model?: string | null;
  reranker_model?: string | null;
  is_active?: boolean;
};

export type LLMConfigUpdate = Partial<LLMConfigCreate>;

export type MessageResponse = {
  message: string;
};
