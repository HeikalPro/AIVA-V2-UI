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
  permissions?: string[];
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

export type WidgetInstallmentCalculatorConfig = {
  enabled: boolean;
  types?: ("cash-it" | "instant-approval" | "branches")[];
  products?: Record<
    string,
    {
      label?: string | null;
      apr?: number | null;
      tenors?: number[] | null;
      flat_rates?: Record<string, number> | null;
    }
  > | null;
};

export type WidgetKbQueuesConfig = {
  /** Allow-list of KB queue keys to show in the widget; null/absent = show all. */
  visible_keys?: string[] | null;
};

export type WidgetFeatures = {
  installment_calculator?: WidgetInstallmentCalculatorConfig;
  kb_queues?: WidgetKbQueuesConfig | null;
};

/** One KB queue button available for an account (from GET /accounts/{id}/kb-queues). */
export type KbQueueGroup = {
  key: string;
  label: string;
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
  widget_features?: WidgetFeatures | null;
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
  widget_features?: WidgetFeatures | null;
};

export type AccountUpdate = {
  name?: string;
  description?: string | null;
  corpus_id?: string | null;
  llm_config_id?: number | null;
  status?: string;
  kb_source_base_url?: string | null;
  widget_features?: WidgetFeatures | null;
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
  extra_nav_permissions?: string[];
  created_at?: string | null;
  is_trainee?: boolean;
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

export type TraineeCreate = {
  email: string;
  password: string;
  first_name?: string | null;
  last_name?: string | null;
  account_id: number;
  status?: string;
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

export type UserNavPermissionsUpdate = {
  extra_nav_permissions: string[];
};

export type RoleDefinition = {
  id: number;
  name: string;
  nav_permissions: string[];
};

export type NavPermissionCatalogItem = {
  key: string;
  label: string;
};

export type RoleNavPermissionsUpdate = {
  nav_permissions: string[];
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
  active_queues?: string[];
};

export type QueueGroup = {
  key: string;
  label: string;
};

export type ChatQueueAccess = {
  account_id: number;
  available_queues: QueueGroup[];
  allowed_queues: string[];
  default_active_queues: string[];
};

export type AgentQueueAccess = {
  account_id: number;
  user_id: number;
  available_queues: QueueGroup[];
  assigned_queues: string[];
  allowed_queues: string[];
};

export type AgentQueueSummaryItem = {
  user_id: number;
  queues: QueueGroup[];
  is_restricted: boolean;
};

export type AgentQueueSummary = {
  account_id: number;
  agents: AgentQueueSummaryItem[];
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
  failed_answers?: number | null;
  escalation_count: number | null;
  calculated_at?: string | null;
  failure_reasons?: string | null;
};

export type LLMConfig = {
  id: number;
  provider: string;
  model_name: string;
  comment: string | null;
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
  comment?: string | null;
  api_base_url?: string | null;
  temperature?: number | null;
  max_tokens?: number | null;
  embedding_model?: string | null;
  reranker_model?: string | null;
  is_active?: boolean;
};

export type LLMConfigUpdate = Partial<LLMConfigCreate>;

export type ModelCatalogItem = {
  id: string;
  display_name?: string | null;
  provider?: string | null;
  modality?: string | null;
  context_window?: number | null;
  status?: string | null;
  input_per_1m_egp?: number | null;
  output_per_1m_egp?: number | null;
  currency: string;
};

export type ModelCatalogOut = {
  items: ModelCatalogItem[];
  error?: string | null;
  error_at?: string | null;
  last_success_at?: string | null;
  stale: boolean;
};

export type MessageResponse = {
  message: string;
};

export type AuditLog = {
  id: number;
  created_at: string | null;
  user_id: number | null;
  actor_email: string | null;
  actor_org_id: number | null;
  entity_type: string;
  entity_id: string;
  action_type: string;
  old_value: string | null;
  new_value: string | null;
  ip_address: string | null;
  summary: string | null;
};

export type AuditLogList = {
  items: AuditLog[];
  limit: number;
  offset: number;
};

export type SignInLog = {
  id: number;
  created_at: string | null;
  user_id: number | null;
  user_email: string | null;
  event_type: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: string | null;
  summary: string | null;
};

export type SignInLogList = {
  items: SignInLog[];
  limit: number;
  offset: number;
};

export type HttpRequestLog = {
  id: number;
  created_at?: string | null;
  http_method: string;
  path: string;
  query_string?: string | null;
  handler_name?: string | null;
  route_template?: string | null;
  status_code: number;
  duration_ms: number;
  user_id?: number | null;
  user_email?: string | null;
  org_id?: number | null;
  user_roles?: string | null;
  actor_label?: string | null;
  client_ip?: string | null;
  summary?: string | null;
};

export type HttpRequestLogList = {
  items: HttpRequestLog[];
  limit: number;
  offset: number;
};

export type RagRetrieval = {
  id: number;
  created_at?: string | null;
  session_id?: number | null;
  account_id?: number | null;
  account_name?: string | null;
  corpus_id?: string | null;
  query_text?: string | null;
  top_k?: number | null;
  verticals?: string | null;
  status: string;
  chunks_returned?: number | null;
  top_score?: number | null;
  retrieval_ms?: number | null;
  error_message?: string | null;
  chunks_json?: string | null;
  source?: string | null;
  summary?: string | null;
};

export type RagRetrievalList = {
  items: RagRetrieval[];
  limit: number;
  offset: number;
};

export type AiRequest = {
  id: number;
  created_at?: string | null;
  session_id?: number | null;
  account_id?: number | null;
  account_name?: string | null;
  organization_id?: number | null;
  user_email?: string | null;
  model_name?: string | null;
  provider?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  response_time_ms?: number | null;
  total_cost?: number | null;
  status?: string | null;
  error_message?: string | null;
  source?: string | null;
  summary?: string | null;
};

export type AiRequestList = {
  items: AiRequest[];
  limit: number;
  offset: number;
};

export type AiTimeseriesPoint = {
  day: string; // YYYY-MM-DD
  calls: number;
  avg_latency_ms?: number | null;
  total_tokens: number;
};

export type ErrorLogRecord = {
  id: number;
  created_at?: string | null;
  exception_type: string;
  exception_message?: string | null;
  stack_trace?: string | null;
  source?: string | null;
  http_method?: string | null;
  path?: string | null;
  route_template?: string | null;
  status_code?: number | null;
  request_id?: string | null;
  user_id?: number | null;
  user_email?: string | null;
  org_id?: number | null;
  client_ip?: string | null;
};

export type ErrorTypeCount = {
  exception_type: string;
  count: number;
};

export type ErrorLogList = {
  items: ErrorLogRecord[];
  type_counts: ErrorTypeCount[];
  limit: number;
  offset: number;
};

export type AiMetricsSummary = {
  total_calls: number;
  avg_latency_ms?: number | null;
  min_latency_ms?: number | null;
  max_latency_ms?: number | null;
  total_tokens: number;
  total_cost?: number | null;
  success_count: number;
  failed_count: number;
  success_rate?: number | null;
  error_rate?: number | null;
};

export type AiMetricsBreakdownItem = {
  model_name: string;
  provider?: string | null;
  count: number;
  avg_latency_ms?: number | null;
  min_latency_ms?: number | null;
  max_latency_ms?: number | null;
  total_tokens: number;
  error_rate?: number | null;
};

export type AiMetrics = {
  summary: AiMetricsSummary;
  by_model: AiMetricsBreakdownItem[];
};

export type ComponentStatus = {
  status: string; // up | down | not_configured | unknown
  latency_ms?: number | null;
  detail?: string | null;
};

export type RedisStatus = ComponentStatus & {
  queue_name?: string | null;
  queue_depth?: number | null;
};

export type ResourceStats = {
  cpu_percent?: number | null;
  memory_percent?: number | null;
  memory_used_mb?: number | null;
  memory_total_mb?: number | null;
  detail?: string | null;
};

export type TrafficStats = {
  window_minutes: number;
  request_count?: number | null;
  error_count?: number | null;
  error_rate?: number | null;
  requests_per_minute?: number | null;
  avg_latency_ms?: number | null;
};

export type SystemHealth = {
  status: string; // ok | degraded | down
  generated_at: string;
  database: ComponentStatus;
  redis: RedisStatus;
  resources: ResourceStats;
  sse_connections: number;
  traffic: TrafficStats;
};

export type ComponentHealth = {
  key: string;
  label: string;
  status: string; // up | down | degraded | not_configured | unknown
  latency_ms?: number | null;
  detail?: string | null;
  info?: string | null;
};

export type SystemComponents = {
  generated_at: string;
  components: ComponentHealth[];
};

export type PlatformInfo = {
  app_name: string;
  hostname?: string | null;
  os?: string | null;
  os_detail?: string | null;
  python_version?: string | null;
};

export type CpuTimes = {
  user?: number | null;
  system?: number | null;
  idle?: number | null;
  iowait?: number | null;
};

export type CpuInfo = {
  percent?: number | null;
  cores?: number | null;
  freq_mhz?: number | null;
  per_core: (number | null)[];
  times: CpuTimes;
  load_avg?: number[] | null;
};

export type MemoryInfo = {
  total_mb?: number | null;
  used_mb?: number | null;
  available_mb?: number | null;
  percent?: number | null;
  cached_mb?: number | null;
  buffers_mb?: number | null;
};

export type SwapInfo = {
  total_mb?: number | null;
  used_mb?: number | null;
  percent?: number | null;
};

export type DiskInfo = {
  total_gb?: number | null;
  used_gb?: number | null;
  free_gb?: number | null;
  percent?: number | null;
};

export type DiskIoInfo = {
  read_mbps?: number | null;
  write_mbps?: number | null;
  read_iops?: number | null;
  write_iops?: number | null;
  read_total?: number | null;
  write_total?: number | null;
};

export type NetworkInfo = {
  sent_total_gb?: number | null;
  recv_total_gb?: number | null;
  packets_sent?: number | null;
  packets_recv?: number | null;
  errin?: number | null;
  errout?: number | null;
  dropin?: number | null;
  dropout?: number | null;
  sent_mbps?: number | null;
  recv_mbps?: number | null;
};

export type ProcessInfo = {
  pid?: number | null;
  memory_mb?: number | null;
  num_threads?: number | null;
  cpu_percent?: number | null;
};

export type SystemResources = {
  generated_at: string;
  platform: PlatformInfo;
  cpu: CpuInfo;
  memory: MemoryInfo;
  swap?: SwapInfo | null;
  disk: DiskInfo;
  disk_io: DiskIoInfo;
  network: NetworkInfo;
  process: ProcessInfo;
  uptime_seconds?: number | null;
  boot_time?: string | null;
  detail?: string | null;
};
