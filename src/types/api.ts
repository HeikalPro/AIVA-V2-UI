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

export type WidgetBrandingConfig = {
  title?: string | null;
  subtitle?: string | null;
  accent_color?: string | null;
  logo_url?: string | null;
};

export type WidgetLocationItem = {
  name: string;
  area?: string | null;
  address?: string | null;
  phone?: string | null;
  hours?: string | null;
  maps_url?: string | null;
};

export type WidgetLocationsConfig = {
  enabled: boolean;
  items: WidgetLocationItem[];
};

export type WidgetFeatures = {
  installment_calculator?: WidgetInstallmentCalculatorConfig;
  kb_queues?: WidgetKbQueuesConfig | null;
  branding?: WidgetBrandingConfig | null;
  locations?: WidgetLocationsConfig | null;
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
  active_queues: string[];
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

export type HttpRequestStatsSummary = {
  total_requests: number;
  unique_users: number;
  unique_endpoints: number;
  avg_duration_ms?: number | null;
  max_duration_ms?: number | null;
  error_count: number;
  error_rate?: number | null;
};

export type HttpEndpointStat = {
  http_method: string;
  endpoint: string;
  handler_name?: string | null;
  count: number;
  unique_users: number;
  avg_duration_ms?: number | null;
  max_duration_ms?: number | null;
  error_count: number;
  error_rate?: number | null;
  last_called_at?: string | null;
};

export type HttpUserStat = {
  actor: string;
  user_id?: number | null;
  count: number;
  unique_endpoints: number;
  error_count: number;
  last_seen_at?: string | null;
};

export type HttpRequestStats = {
  summary: HttpRequestStatsSummary;
  by_endpoint: HttpEndpointStat[];
  by_user: HttpUserStat[];
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

// ---------------------------------------------------------------------------
// Document intelligence (/api/doc-intel). Mirrors AIVA-V2/backend/doc_intel/
// schemas.py and constants.py; change both together. All timestamps are UTC
// ISO-8601 strings ending in "Z".
// ---------------------------------------------------------------------------

export type KbStageName = "upload" | "extraction" | "chunking" | "embedding" | "publishing";

export type StageStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "SKIPPED";

export type DocStatus = "QUEUED" | "PROCESSING" | "PUBLISHED" | "FAILED" | "UNPUBLISHED";

export type HealthStatus = "HEALTHY" | "FAILED" | "NOT_CONFIGURED";

export type StageOut = {
  name: KbStageName;
  status: StageStatus;
  error?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
};

export type DocWarningOut = {
  code: string;
  message: string;
  page?: number | null;
};

export type KbDocumentOut = {
  id: number;
  batch_id?: string | null;
  account_id: number;
  account_name?: string | null;
  organization_name?: string | null;
  corpus_id: string;
  queue_keys: string[];
  /** Labels resolved from the corpus queue catalog at read time; same order as queue_keys. */
  queue_labels: string[];
  vertical?: string | null;
  filename: string;
  content_type?: string | null;
  size_bytes?: number | null;
  sha256?: string | null;
  status: DocStatus;
  /** Always the five stages, in pipeline order. */
  stages: StageOut[];
  failed_stage?: KbStageName | null;
  error_message?: string | null;
  warnings: DocWarningOut[];
  page_count?: number | null;
  chunk_count?: number | null;
  tokens_used?: number | null;
  cost_usd?: number | null;
  attempts: number;
  /** 1-based position among QUEUED documents (null unless status is QUEUED). */
  queue_position?: number | null;
  uploaded_by?: number | null;
  uploaded_by_email?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  published_at?: string | null;
};

export type KbDocumentListOut = {
  items: KbDocumentOut[];
  limit: number;
  offset: number;
  total: number;
};

export type KbUploadOut = {
  batch_id: string;
  accepted: number;
  rejected: number;
  /** One entry per uploaded file, rejected files included (upload stage FAILED + reason). */
  documents: KbDocumentOut[];
};

export type KbQueuesUpdate = {
  /** 1–50 queue keys from the account's queue catalog. */
  queue_keys: string[];
};

export type KbPreviewPage = {
  number: number;
  text: string;
};

export type KbPreviewOut = {
  document_id: number;
  page_count?: number | null;
  truncated: boolean;
  pages: KbPreviewPage[];
  extractor: Record<string, unknown>;
};

export type DocIntelStatusOut = {
  enabled: boolean;
  /** True when migration V001's tables exist. */
  installed: boolean;
  schema_version?: string | null;
  worker_running: boolean;
  extraction_available: boolean;
  extraction_unavailable_reason?: string | null;
  detail?: string | null;
  /** Upload limits, so the UI can pre-check files before sending them. */
  max_upload_mb: number;
  max_files_per_upload: number;
  allowed_extensions: string[];
  /** Phase 2 (SharePoint -> CRM): true when migration V002's tables exist. */
  crm_installed: boolean;
  sync_worker_running: boolean;
  /** DOC_INTEL_SCHEDULER_ENABLED: automatic syncs (and periodic health checks) run on this server. */
  scheduler_enabled: boolean;
  /** False when DOC_INTEL_SECRETS_KEY is missing/invalid: credentials cannot be saved or read. */
  secrets_key_configured: boolean;
};

export type HealthComponentOut = {
  key: string;
  label: string;
  status: HealthStatus;
  reason?: string | null;
  suggested_action?: string | null;
  checked_at?: string | null;
  last_success_at?: string | null;
  last_failure_at?: string | null;
  consecutive_failures: number;
  latency_ms?: number | null;
  details: Record<string, unknown>;
};

export type HealthOverviewOut = {
  /** FAILED when any component is FAILED; NOT_CONFIGURED components do not count. */
  overall: "HEALTHY" | "FAILED";
  checked_at?: string | null;
  /** No stored results, or the newest is older than DOC_INTEL_HEALTH_STALE_MINUTES. */
  stale: boolean;
  /** POST /health/run was ignored because checks ran too recently. */
  throttled: boolean;
  components: HealthComponentOut[];
};

export type HealthEventOut = {
  id: number;
  component_key: string;
  label: string;
  old_status?: HealthStatus | null;
  new_status: HealthStatus;
  reason?: string | null;
  created_at?: string | null;
};

export type FailureItemOut = {
  /** kb_document = knowledge import; crm_file = a SharePoint file; sync_run = a SharePoint sync run. */
  kind: "kb_document" | "crm_file" | "sync_run";
  id: number;
  title: string;
  account_name?: string | null;
  stage?: string | null;
  reason?: string | null;
  occurred_at?: string | null;
};

export type FailuresOut = {
  days: number;
  items: FailureItemOut[];
};

export type ActivityItemOut = {
  kind: "kb_document" | "health" | "crm_file" | "sync_run";
  level: "info" | "warning" | "error";
  message: string;
  ref_id?: number | null;
  occurred_at?: string | null;
};

export type ActivityOut = {
  items: ActivityItemOut[];
};

// ---------------------------------------------------------------------------
// SharePoint / OneDrive -> CRM sync (Flow 2, /api/doc-intel). Mirrors the Phase 2
// models at the end of AIVA-V2/backend/doc_intel/schemas.py and constants.py.
// The client secret is write-only: SourceCreate/SourceUpdate carry it, no response does.
// ---------------------------------------------------------------------------

export type CrmStageName = "download" | "extraction" | "intelligence" | "entities" | "persist";

export type SourceStatus = "ACTIVE" | "DISABLED" | "DELETED";

export type RunTrigger = "SCHEDULED" | "MANUAL";

export type RunStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED";

export type FileState = "ACTIVE" | "DELETED";

export type FileStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "SKIPPED";

export type EntityStatus = "ACTIVE" | "WITHDRAWN";

export type SyncRunOut = {
  id: number;
  source_id: number;
  trigger_type: RunTrigger;
  triggered_by?: number | null;
  triggered_by_email?: string | null;
  status: RunStatus;
  files_seen: number;
  files_new: number;
  files_changed: number;
  files_deleted: number;
  files_unchanged: number;
  files_failed: number;
  error_message?: string | null;
  /** e.g. {listing_complete: boolean, truncated_reason: string | null, seconds: number} */
  details: Record<string, unknown>;
  created_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
};

export type SyncRunListOut = {
  items: SyncRunOut[];
  limit: number;
  offset: number;
  total: number;
};

export type SourceOut = {
  id: number;
  name: string;
  account_id?: number | null;
  account_name?: string | null;
  provider: string;
  /** Decrypted identifiers (Super Admin + Developer). The secret itself is never returned. */
  tenant_id?: string | null;
  client_id?: string | null;
  client_secret_set: boolean;
  /** e.g. "…abcd" */
  client_secret_hint?: string | null;
  secret_updated_at?: string | null;
  /** False when the stored credentials cannot be decrypted (key missing or rotated away). */
  credentials_readable: boolean;
  site_url?: string | null;
  drive_name?: string | null;
  folder_path?: string | null;
  recursive: boolean;
  file_extensions: string[];
  use_intelligence: boolean;
  sync_enabled: boolean;
  sync_interval_days: number;
  sync_hour: number;
  next_sync_at?: string | null;
  last_sync_at?: string | null;
  last_sync_status?: RunStatus | null;
  last_sync_error?: string | null;
  last_success_at?: string | null;
  status: SourceStatus;
  /** The QUEUED/RUNNING run, if any ("Sync now" is disabled while one exists). */
  active_run?: SyncRunOut | null;
  /** {files_active, files_failed, files_deleted, entities_active} */
  counts: Record<string, number>;
  created_at?: string | null;
  updated_at?: string | null;
};

export type SourceCreate = {
  /** 1–200 characters. */
  name: string;
  account_id?: number | null;
  tenant_id: string;
  client_id: string;
  /** Write-only; never returned and never kept in a query cache. */
  client_secret: string;
  /** https://<tenant>.sharepoint.com/sites/<site> (or a OneDrive for Business personal site). */
  site_url: string;
  /** Document library name; null = the site's default library ("Documents"). */
  drive_name?: string | null;
  /** Folder inside the library, e.g. "/CRM/Contracts"; null or "/" = the library root. */
  folder_path?: string | null;
  recursive?: boolean;
  file_extensions?: string[];
  sync_enabled?: boolean;
  /** 1–365. */
  sync_interval_days?: number;
  /** 0–23, in the server's schedule time zone. */
  sync_hour?: number;
};

export type SourceUpdate = {
  name?: string;
  account_id?: number | null;
  tenant_id?: string;
  client_id?: string;
  /** Omit to keep the stored secret. */
  client_secret?: string;
  site_url?: string;
  drive_name?: string | null;
  folder_path?: string | null;
  recursive?: boolean;
  file_extensions?: string[];
  sync_enabled?: boolean;
  sync_interval_days?: number;
  sync_hour?: number;
  status?: "ACTIVE" | "DISABLED";
};

export type ConnectionStepOut = {
  /** credentials | token | site | drive | folder | listing */
  key: string;
  label: string;
  ok: boolean;
  latency_ms?: number | null;
  detail?: string | null;
  suggested_action?: string | null;
};

export type ConnectionTestOut = {
  ok: boolean;
  steps: ConnectionStepOut[];
  checked_at?: string | null;
  /** A few file names found in the folder (only when listing succeeded). */
  sample_files: string[];
  files_found?: number | null;
};

export type CrmStageOut = {
  name: CrmStageName;
  status: StageStatus;
  error?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
};

export type SourceFileOut = {
  id: number;
  source_id: number;
  name?: string | null;
  path?: string | null;
  web_url?: string | null;
  size_bytes?: number | null;
  modified_at?: string | null;
  state: FileState;
  status: FileStatus;
  /** Always the five stages, in pipeline order. */
  stages: CrmStageOut[];
  failed_stage?: CrmStageName | null;
  error_message?: string | null;
  warnings: DocWarningOut[];
  entity_count?: number | null;
  is_valid?: boolean | null;
  attempts: number;
  last_run_id?: number | null;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
  processed_at?: string | null;
  deleted_at?: string | null;
  updated_at?: string | null;
};

export type SourceFileListOut = {
  items: SourceFileOut[];
  limit: number;
  offset: number;
  total: number;
};

export type CrmEntityOut = {
  id: number;
  source_id: number;
  source_name?: string | null;
  source_file_id: number;
  file_name?: string | null;
  account_id?: number | null;
  entity_type: string;
  display_value?: string | null;
  /** 0..1 */
  confidence?: number | null;
  is_valid?: boolean | null;
  /** field -> value (the CRM record, without "_meta") */
  fields: Record<string, unknown>;
  /** The "_meta" block: per-field confidence, extractor and provenance (page, block, source text). */
  provenance: Record<string, unknown>;
  /** Validation issues: {entity_type, entity_index, field, severity, code, message}. */
  issues: Record<string, unknown>[];
  status: EntityStatus;
  created_at?: string | null;
  updated_at?: string | null;
  withdrawn_at?: string | null;
};

export type CrmEntityListOut = {
  items: CrmEntityOut[];
  limit: number;
  offset: number;
  total: number;
};
