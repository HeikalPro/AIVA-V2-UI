import { useCallback, useEffect, useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES } from "@/lib/roles";
import { useAccounts } from "@/hooks/useAccounts";
import {
  useChatSessions,
  useCreateSession,
  useSessionMessages,
  sendMessageStream,
} from "@/hooks/useChat";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { PageHeader } from "@/components/shared/PageHeader";
import { formatQueryError, formatUserError } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { ChatMessage, ChatSession, KbSource } from "@/types/api";

type Msg = { role: string; text: string; sources?: KbSource[] };

function sessionStorageKey(accountId: number) {
  return `aiva_chat_session_${accountId}`;
}

function messagesToUi(rows: ChatMessage[]): Msg[] {
  return rows.map((m) => ({
    role: m.sender_type,
    text: m.message_text,
    sources: m.sources?.length ? m.sources : undefined,
  }));
}

function formatAgentName(session: ChatSession): string {
  const name = [session.agent_first_name, session.agent_last_name].filter(Boolean).join(" ").trim();
  if (name) return name;
  if (session.agent_email) return session.agent_email;
  return `Agent #${session.user_id}`;
}

function formatSessionLabel(session: ChatSession) {
  const agent = formatAgentName(session);
  const date = session.started_at ? new Date(session.started_at).toLocaleString() : "";
  const msgs =
    session.message_count != null
      ? `${session.message_count} message${session.message_count === 1 ? "" : "s"}`
      : "";
  return [agent, date, msgs].filter(Boolean).join(" · ");
}

export function ChatPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN);
  const {
    data: accounts = [],
    isError: accountsError,
    error: accountsLoadError,
  } = useAccounts(isSuperAdmin ? null : user?.organization_id);
  const createSession = useCreateSession();

  const [accountId, setAccountId] = useState<number | null>(null);
  const selectedAccountId = accountId ?? accounts[0]?.id ?? null;
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: sessions = [], isLoading: sessionsLoading } = useChatSessions(selectedAccountId);
  const {
    data: storedMessages,
    refetch: refetchMessages,
    isFetching: fetchingMessages,
  } = useSessionMessages(sessionId);

  const applyMessages = useCallback((rows: ChatMessage[] | undefined) => {
    setMessages(rows?.length ? messagesToUi(rows) : []);
  }, []);

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
      const session = await createSession.mutateAsync(selectedAccountId);
      setSessionId(session.id);
      setMessages([]);
      setLatency(null);
      localStorage.setItem(sessionStorageKey(selectedAccountId), String(session.id));
    } catch (e) {
      setError(formatUserError(e, "chat"));
    }
  }

  function onAccountChange(nextAccountId: number) {
    setAccountId(nextAccountId);
    setSessionId(null);
    setMessages([]);
    setLatency(null);
  }

  function onSessionChange(nextSessionId: number) {
    setSessionId(nextSessionId);
    setLatency(null);
  }

  async function send() {
    if (!sessionId || !input.trim()) return;
    setError(null);
    setStreaming(true);
    setLatency(null);
    const userText = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "USER", text: userText }, { role: "AI", text: "" }]);

    let assistant = "";
    let sources: KbSource[] | undefined;
    try {
      await sendMessageStream(sessionId, userText, 10, (ev) => {
        if (ev.type === "token" && ev.text) {
          assistant += ev.text;
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: "AI", text: assistant, sources };
            return copy;
          });
        }
        if (ev.type === "error" && ev.message) {
          assistant = assistant.trim()
            ? `${assistant}\n\nError: ${ev.message}`
            : `Error: ${ev.message}`;
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: "AI", text: assistant, sources };
            return copy;
          });
        }
        if (ev.type === "done") {
          if (ev.latency_ms !== undefined) setLatency(ev.latency_ms);
          if (ev.sources?.length) {
            sources = ev.sources;
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last?.role === "AI") copy[copy.length - 1] = { ...last, sources: ev.sources };
              return copy;
            });
          }
        }
      });
      await qc.invalidateQueries({ queryKey: ["chat-messages", sessionId] });
      await qc.invalidateQueries({ queryKey: ["chat-sessions", selectedAccountId] });
      if (sources?.length) {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === "AI") copy[copy.length - 1] = { ...last, sources };
          return copy;
        });
      }
    } catch (e) {
      setError(formatUserError(e, "chat"));
    } finally {
      setStreaming(false);
    }
  }

  const historyBusy = loadingHistory || fetchingMessages;

  return (
    <div className="space-y-6">
      <PageHeader icon={MessageSquare} title="Chat" description="AI assistant chat with SSE streaming" />

      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[200px]">
          <Label>Account</Label>
          <Select
            value={selectedAccountId ?? ""}
            onChange={(e) => onAccountChange(Number(e.target.value))}
            className="mt-1"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="min-w-[220px]">
          <Label>Session</Label>
          <Select
            value={sessionId ?? ""}
            onChange={(e) => onSessionChange(Number(e.target.value))}
            className="mt-1"
            disabled={!selectedAccountId || sessionsLoading || sessions.length === 0}
          >
            {sessions.length === 0 ? (
              <option value="">No sessions yet</option>
            ) : (
              sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  #{s.id} — {formatSessionLabel(s)}
                </option>
              ))
            )}
          </Select>
        </div>

        <Button onClick={startSession} disabled={!selectedAccountId || createSession.isPending}>
          New Session
        </Button>
        <Button
          variant="outline"
          onClick={loadHistory}
          disabled={!sessionId || historyBusy}
        >
          {historyBusy ? "Loading…" : "Load History"}
        </Button>
      </div>

      {accountsError && (
        <ErrorAlert message={formatQueryError(accountsLoadError)} />
      )}
      {!accountsError && accounts.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No account assigned. Ask an admin to assign you to an account in Users.
        </div>
      )}

      <ErrorAlert message={error} />

      <div className="max-w-3xl space-y-3">
        {historyBusy && messages.length === 0 && (
          <p className="text-sm text-muted-foreground">Loading conversation…</p>
        )}
        {!historyBusy && sessionId && messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No messages in this session yet. Send a message or pick another session.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-xl border px-4 py-3 ${
              m.role === "AI"
                ? "border-l-4 border-l-[#004080] bg-white"
                : "border-l-4 border-l-emerald-500 bg-white"
            }`}
          >
            <p className="mb-1 text-xs font-semibold uppercase text-slate-500">{m.role}</p>
            <p className="whitespace-pre-wrap text-sm text-slate-800">
              {m.text || (streaming && i === messages.length - 1 ? "..." : "")}
            </p>
            {m.role === "AI" && m.sources && m.sources.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
                <span className="text-xs font-semibold uppercase text-slate-500">Sources</span>
                {m.sources.map((s) => (
                  <a
                    key={s.parent_id}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-[#004080] hover:underline"
                  >
                    {s.parent_id}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {latency !== null && <p className="text-sm text-muted-foreground">Latency: {latency} ms</p>}

      <div className="flex max-w-3xl gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={!sessionId || streaming}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          className="flex-1"
        />
        <Button onClick={send} disabled={!sessionId || streaming}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
