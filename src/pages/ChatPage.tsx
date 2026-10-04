import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Building2, ExternalLink, MessageSquare, MessagesSquare, Plus, RefreshCw, Send } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { cn } from "@/lib/utils";
import { ROLES } from "@/lib/roles";
import { useAccounts } from "@/hooks/useAccounts";
import { formatDateTime, formatDurationMs, formatNumber, formatRelativeTime } from "@/lib/format";
import {
  useChatSessions,
  useCreateSession,
  useSessionMessages,
  sendMessageStream,
} from "@/hooks/useChat";
import { useChatQueueAccess, useUpdateSessionQueues } from "@/hooks/useKbQueues";
import { QueueSelector } from "@/components/chat/QueueSelector";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { Page, PageHeading } from "@/components/shell/page";
import { EmptyState } from "@/components/data/empty-state";
import { Status } from "@/components/data/status";
import { formatQueryError, formatUserError } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip } from "@/components/ui/tooltip";
import type { ChatMessage, ChatSession, KbSource } from "@/types/api";

type Msg = {
  role: string;
  text: string;
  createdAt?: string | null;
  latencyMs?: number | null;
  sources?: KbSource[];
};

function sessionStorageKey(accountId: number) {
  return `aiva_chat_session_${accountId}`;
}

function messagesToUi(rows: ChatMessage[]): Msg[] {
  return rows.map((m) => ({
    role: m.sender_type,
    text: m.message_text,
    createdAt: m.created_at,
    latencyMs: m.latency_ms,
    sources: m.sources,
  }));
}

/** Messages sent by the person (stream uses "USER", stored rows use the backend sender type). */
function isUserRole(role: string): boolean {
  const r = role.trim().toLowerCase();
  return r === "user" || r === "agent" || r === "human";
}

function formatAgentName(session: ChatSession): string {
  const name = [session.agent_first_name, session.agent_last_name].filter(Boolean).join(" ").trim();
  if (name) return name;
  if (session.agent_email) return session.agent_email;
  return `Agent #${session.user_id}`;
}

export function ChatPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const workspace = useWorkspace();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN);
  // Same query (and cache) as the workspace list; read here for its error details.
  const { error: accountsLoadError } = useAccounts(isSuperAdmin ? null : user?.organization_id);
  const accounts = workspace.accounts;
  const accountsError = workspace.isError;
  const createSession = useCreateSession();
  const updateSessionQueues = useUpdateSessionQueues();

  const selectedAccountId = workspace.accountId;
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [selectedQueues, setSelectedQueues] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: sessions = [], isLoading: sessionsLoading } = useChatSessions(selectedAccountId);
  const { data: queueAccess } = useChatQueueAccess(selectedAccountId);
  const {
    data: storedMessages,
    refetch: refetchMessages,
    isFetching: fetchingMessages,
  } = useSessionMessages(sessionId);

  const applyMessages = useCallback((rows: ChatMessage[] | undefined) => {
    setMessages(rows?.length ? messagesToUi(rows) : []);
  }, []);

  // Workspace switched in the shell: start clean for the new account (was the account <select>).
  // Declared before the effects below so their updates for the new account win.
  const lastAccountRef = useRef(selectedAccountId);
  useEffect(() => {
    if (lastAccountRef.current === selectedAccountId) return;
    lastAccountRef.current = selectedAccountId;
    setSessionId(null);
    setMessages([]);
    setLatency(null);
    setSelectedQueues([]);
  }, [selectedAccountId]);

  useEffect(() => {
    if (!queueAccess) return;
    setSelectedQueues((prev) =>
      prev.length ? prev : queueAccess.default_active_queues,
    );
  }, [queueAccess]);

  useEffect(() => {
    if (!sessionId || !sessions.length) return;
    const session = sessions.find((s) => s.id === sessionId);
    if (session?.active_queues?.length) {
      setSelectedQueues(session.active_queues);
    }
  }, [sessionId, sessions]);

  useEffect(() => {
    applyMessages(storedMessages);
  }, [storedMessages, applyMessages]);

  useEffect(() => {
    if (!selectedAccountId || sessionsLoading || sessions.length === 0) return;
    const key = sessionStorageKey(selectedAccountId);
    const saved = localStorage.getItem(key);
    if (saved) {
      const id = Number(saved);
      if (sessions.some((s) => s.id === id)) {
        setSessionId(id);
        return;
      }
    }
    setSessionId(sessions[0].id);
  }, [selectedAccountId, sessions, sessionsLoading]);

  useEffect(() => {
    if (sessionId && selectedAccountId) {
      localStorage.setItem(sessionStorageKey(selectedAccountId), String(sessionId));
    }
  }, [sessionId, selectedAccountId]);

  async function loadHistory() {
    if (!sessionId) return;
    setError(null);
    setLoadingHistory(true);
    try {
      const result = await refetchMessages();
      applyMessages(result.data);
    } catch (e) {
      setError(formatUserError(e, "chat"));
    } finally {
      setLoadingHistory(false);
    }
  }

  async function startSession() {
    if (!selectedAccountId) return;
    setError(null);
    try {
      const session = await createSession.mutateAsync({
        accountId: selectedAccountId,
        activeQueues: selectedQueues.length ? selectedQueues : queueAccess?.default_active_queues,
      });
      setSessionId(session.id);
      if (session.active_queues?.length) setSelectedQueues(session.active_queues);
      setMessages([]);
      setLatency(null);
      localStorage.setItem(sessionStorageKey(selectedAccountId), String(session.id));
    } catch (e) {
      setError(formatUserError(e, "chat"));
    }
  }

  async function onQueuesChange(keys: string[]) {
    setSelectedQueues(keys);
    if (!sessionId) return;
    try {
      await updateSessionQueues.mutateAsync({ sessionId, activeQueues: keys });
    } catch (e) {
      setError(formatUserError(e, "chat"));
    }
  }

  function onSessionChange(nextSessionId: number) {
    setSessionId(nextSessionId);
    setLatency(null);
  }

  /* ---- transcript scrolling: follow new content only while the reader is at the bottom ---- */
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  function onTranscriptScroll() {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  }
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);
  // A different session starts at its newest message.
  useEffect(() => {
    atBottomRef.current = true;
  }, [sessionId]);

  async function send() {
    if (!sessionId || !input.trim()) return;
    setError(null);
    setStreaming(true);
    setLatency(null);
    const userText = input.trim();
    setInput("");
    atBottomRef.current = true;
    setMessages((prev) => [...prev, { role: "USER", text: userText }, { role: "AI", text: "" }]);

    let assistant = "";
    try {
      await sendMessageStream(sessionId, userText, 10, (ev) => {
        if (ev.type === "token" && ev.text) {
          assistant += ev.text;
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { ...copy[copy.length - 1], role: "AI", text: assistant };
            return copy;
          });
        }
        if (ev.type === "error" && ev.message) {
          assistant = assistant.trim()
            ? `${assistant}\n\nError: ${ev.message}`
            : `Error: ${ev.message}`;
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { ...copy[copy.length - 1], role: "AI", text: assistant };
            return copy;
          });
        }
        if (ev.sources?.length) {
          const sources = ev.sources;
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { ...copy[copy.length - 1], sources };
            return copy;
          });
        }
        if (ev.type === "done") {
          if (ev.latency_ms !== undefined) setLatency(ev.latency_ms);
        }
      });
      await qc.invalidateQueries({ queryKey: ["chat-messages", sessionId] });
      await qc.invalidateQueries({ queryKey: ["chat-sessions", selectedAccountId] });
    } catch (e) {
      setError(formatUserError(e, "chat"));
    } finally {
      setStreaming(false);
    }
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void send();
  }

  const historyBusy = loadingHistory || fetchingMessages;
  const currentSession = sessions.find((s) => s.id === sessionId) ?? null;
  const viewingOwnSession = currentSession == null || currentSession.user_id === user?.id;
  const userLabel = viewingOwnSession ? "You" : currentSession ? formatAgentName(currentSession) : "Agent";
  const lastAssistantIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) if (!isUserRole(messages[i].role)) return i;
    return -1;
  })();
  const noAccount = !workspace.isLoading && !accountsError && accounts.length === 0;
  const sessionsBusy = workspace.isLoading || (selectedAccountId != null && sessionsLoading);

  return (
    <Page width="wide">
      <PageHeading
        title="Chat"
        description={
          workspace.account
            ? `Ask the AI assistant questions answered from the ${workspace.account.name} knowledge base.`
            : "Ask the AI assistant questions answered from your account's knowledge base."
        }
        actions={
          <Button onClick={() => void startSession()} disabled={!selectedAccountId} loading={createSession.isPending}>
            {!createSession.isPending && <Plus aria-hidden="true" className="h-4 w-4" />}
            New session
          </Button>
        }
      />

      {accountsError && <ErrorAlert message={formatQueryError(accountsLoadError)} />}
      <ErrorAlert message={error} />

      {noAccount ? (
        <EmptyState
          icon={Building2}
          title="No account assigned"
          description="Ask an admin to assign you to an account in Users."
          className="rounded-lg border border-border bg-card"
        />
      ) : (
      <div className="grid h-[calc(100dvh-11.5rem)] min-h-[26rem] gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
        {/* ---- sessions ---- */}
        <nav
          aria-label="Chat sessions"
          className="hidden min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card lg:flex"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-muted px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sessions</p>
            {!sessionsLoading && sessions.length > 0 && (
              <span className="text-xs tabular-nums text-muted-foreground">{formatNumber(sessions.length)}</span>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {sessionsBusy ? (
              <div className="space-y-1" aria-busy="true">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="space-y-1.5 px-2.5 py-2">
                    <Skeleton className="h-3.5 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <EmptyState
                size="sm"
                icon={MessagesSquare}
                title="No sessions yet"
                description={selectedAccountId ? "Start a session to chat with the assistant." : undefined}
              />
            ) : (
              <ul className="space-y-0.5">
                {sessions.map((s) => {
                  const active = s.id === sessionId;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        aria-current={active ? "true" : undefined}
                        onClick={() => onSessionChange(s.id)}
                        className={cn(
                          "w-full rounded-md px-2.5 py-2 text-left transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          active ? "bg-primary-muted" : "hover:bg-muted",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate text-sm font-medium",
                              active ? "text-primary-muted-foreground" : "text-foreground",
                            )}
                          >
                            <span dir="auto">{formatAgentName(s)}</span>
                          </span>
                          <span className="shrink-0 font-mono text-xs text-muted-foreground">#{s.id}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {[
                            s.started_at ? formatRelativeTime(s.started_at) : null,
                            s.message_count != null
                              ? `${formatNumber(s.message_count)} message${s.message_count === 1 ? "" : "s"}`
                              : null,
                            s.active_queues?.length ? s.active_queues.join(" + ") : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </nav>

        {/* ---- conversation ---- */}
        <section
          aria-label="Conversation"
          className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card"
        >
          <div className="space-y-2.5 border-b border-border px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="min-w-0 truncate text-base font-semibold text-foreground">
                {currentSession ? (
                  <>
                    <bdi>{formatAgentName(currentSession)}</bdi>
                    <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">#{currentSession.id}</span>
                  </>
                ) : sessionsBusy ? (
                  <Skeleton className="h-5 w-40" />
                ) : (
                  "No session selected"
                )}
              </h2>
              {currentSession?.session_status && <Status value={currentSession.session_status} />}
              {/* Session picker below lg, where the session list is hidden. */}
              {sessions.length > 0 && (
                <Select
                  aria-label="Session"
                  controlSize="sm"
                  className="w-56 lg:hidden"
                  value={sessionId ?? ""}
                  onChange={(e) => onSessionChange(Number(e.target.value))}
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      #{s.id} — {formatAgentName(s)}
                    </option>
                  ))}
                </Select>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => void loadHistory()}
                disabled={!sessionId}
                loading={historyBusy}
              >
                {!historyBusy && <RefreshCw aria-hidden="true" className="h-4 w-4" />}
                Reload
              </Button>
            </div>
            {queueAccess && queueAccess.available_queues.length > 0 && (
              <QueueSelector
                size="xs"
                queues={queueAccess.available_queues}
                selected={selectedQueues.length ? selectedQueues : queueAccess.default_active_queues}
                onChange={(keys) => void onQueuesChange(keys)}
                disabled={streaming || updateSessionQueues.isPending}
              />
            )}
          </div>

          {/* transcript */}
          <div
            ref={scrollRef}
            onScroll={onTranscriptScroll}
            role="log"
            aria-live="polite"
            aria-busy={streaming || undefined}
            aria-label="Messages"
            className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-surface-muted/40 px-4 py-4"
          >
            {historyBusy && messages.length === 0 && (
              <div className="space-y-4" aria-hidden="true">
                <Skeleton className="ml-auto h-12 w-2/5 rounded-lg" />
                <Skeleton className="h-20 w-3/5 rounded-lg" />
                <Skeleton className="ml-auto h-10 w-1/3 rounded-lg" />
              </div>
            )}
            {!historyBusy && !sessionId && sessionsBusy && (
              <div className="space-y-4" aria-hidden="true">
                <Skeleton className="ml-auto h-12 w-2/5 rounded-lg" />
                <Skeleton className="h-20 w-3/5 rounded-lg" />
              </div>
            )}
            {!historyBusy && !sessionId && !sessionsBusy && (
              <EmptyState
                icon={MessageSquare}
                title="No session selected"
                description="Pick a session or start a new one to chat with the assistant."
              />
            )}
            {!historyBusy && sessionId && messages.length === 0 && (
              <EmptyState
                icon={MessageSquare}
                title="No messages in this session yet"
                description="Send a message or pick another session."
              />
            )}
            {messages.map((m, i) => {
              const mine = isUserRole(m.role);
              const pending = streaming && i === messages.length - 1 && !mine;
              const shownLatency = m.latencyMs ?? (i === lastAssistantIndex ? latency : null);
              return (
                <div key={i} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[min(42rem,85%)] space-y-1", mine && "items-end text-right")}>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span className={cn("font-medium", mine ? "ml-auto text-foreground" : "text-foreground")}>
                        {mine ? <bdi>{userLabel}</bdi> : "AIVA"}
                      </span>
                      {m.createdAt && (
                        <Tooltip content={formatDateTime(m.createdAt)}>
                          <span>{formatRelativeTime(m.createdAt)}</span>
                        </Tooltip>
                      )}
                      {!mine && shownLatency != null && <span>· {formatDurationMs(shownLatency)}</span>}
                    </p>
                    <div
                      className={cn(
                        "rounded-lg px-3.5 py-2.5 text-left text-sm leading-6",
                        mine
                          ? "bg-primary-muted text-foreground"
                          : "border border-border bg-card text-foreground",
                      )}
                    >
                      {m.text ? (
                        // One block per line so each line picks its own direction (Arabic / English).
                        <div className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                          {m.text.split(/\r?\n/).map((line, li) => (
                            <p key={li} dir="auto" className="min-h-6">
                              {line}
                            </p>
                          ))}
                        </div>
                      ) : pending ? (
                        <span className="inline-flex items-center gap-2 text-muted-foreground">
                          <Spinner size="sm" />
                          Generating…
                        </span>
                      ) : null}
                    </div>
                    {!mine && m.sources && m.sources.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-xs text-muted-foreground">
                        <span>Sources</span>
                        {m.sources.map((source) => (
                          <Button
                            key={`${source.parent_id}-${source.url}`}
                            asChild
                            variant="link"
                            size="sm"
                            className="h-auto gap-1 px-0 font-mono text-xs"
                          >
                            <a href={source.url} target="_blank" rel="noreferrer noopener">
                              {source.parent_id}
                              <ExternalLink aria-hidden="true" className="h-3 w-3" />
                              <span className="sr-only">(opens in a new tab)</span>
                            </a>
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* composer */}
          <div className="border-t border-border bg-card px-4 py-3">
            <div className="flex items-end gap-2">
              <Textarea
                aria-label="Message"
                dir="auto"
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onComposerKeyDown}
                placeholder={sessionId ? "Ask a question…" : "Start or pick a session to send messages"}
                disabled={!sessionId || streaming}
                className="max-h-40 min-h-[2.75rem] flex-1 resize-none"
              />
              <Button onClick={() => void send()} disabled={!sessionId || streaming || !input.trim()} loading={streaming}>
                {!streaming && <Send aria-hidden="true" className="h-4 w-4" />}
                Send
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground" aria-live="polite">
              {streaming ? "Generating an answer…" : "Enter to send · Shift + Enter for a new line"}
            </p>
          </div>
        </section>
      </div>
      )}
    </Page>
  );
}
